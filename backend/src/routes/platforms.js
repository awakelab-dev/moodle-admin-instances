const express = require('express');
const router = express.Router();
const MoodleClient = require('../services/moodleClient');
const {
  GLOBAL_COST_PER_GB,
  normalizeCurrency,
  normalizeOptionalAmount,
  normalizeUrl,
  readPlatformConfig,
  slugifyPlatform,
  writePlatformConfig,
  hasFinancialConfig,
  normalizeIsActive,
} = require('../config/platformConfig');

function getErrorMessage(err) {
  return err?.message || 'Error desconocido al conectar con Moodle.';
}

function reachedMoodleServer(err) {
  return /Moodle WS error \[/.test(getErrorMessage(err));
}

async function runWsCheck({ label, wsfunction, required = true, execute }) {
  try {
    const data = await execute();
    return {
      label,
      wsfunction,
      required,
      status: 'ok',
      message: 'OK',
      data,
      reachedMoodle: true,
    };
  } catch (err) {
    return {
      label,
      wsfunction,
      required,
      status: 'error',
      message: getErrorMessage(err),
      data: null,
      reachedMoodle: reachedMoodleServer(err),
    };
  }
}

function makeSkippedCheck(label, wsfunction, required, message) {
  return {
    label,
    wsfunction,
    required,
    status: 'skipped',
    message,
  };
}

function toPublicCheck(check) {
  return {
    label: check.label,
    wsfunction: check.wsfunction,
    required: check.required,
    status: check.status,
    message: check.message,
  };
}

function pickSampleCourseIds(courses) {
  return (Array.isArray(courses) ? courses : [])
    .map((course) => Number(course?.id))
    .filter((courseId) => Number.isFinite(courseId) && courseId > 0)
    .slice(0, 5);
}

function findFirstAssignmentId(assignmentsData) {
  const courses = assignmentsData?.courses || [];
  for (const course of courses) {
    for (const assignment of course.assignments || []) {
      const assignmentId = Number(assignment?.id);
      if (Number.isFinite(assignmentId) && assignmentId > 0) {
        return assignmentId;
      }
    }
  }

  return null;
}

function findFirstForumId(forumsData) {
  const forums = Array.isArray(forumsData) ? forumsData : [];
  for (const forum of forums) {
    const forumId = Number(forum?.id);
    if (Number.isFinite(forumId) && forumId > 0) {
      return forumId;
    }
  }

  return null;
}

function findFirstDiscussionId(discussionsData) {
  const discussions = discussionsData?.discussions || [];
  for (const discussion of discussions) {
    const discussionId = Number(discussion?.discussion ?? discussion?.id);
    if (Number.isFinite(discussionId) && discussionId > 0) {
      return discussionId;
    }
  }

  return null;
}

function buildTestSummary(connectionOk, requiredChecks, optionalChecks) {
  if (!connectionOk) {
    return 'No fue posible conectarse al Web Service de Moodle.';
  }

  const requiredErrors = requiredChecks.filter((check) => check.status === 'error');
  const requiredSkipped = requiredChecks.filter((check) => check.status === 'skipped');
  const optionalErrors = optionalChecks.filter((check) => check.status === 'error');
  const optionalSkipped = optionalChecks.filter((check) => check.status === 'skipped');

  if (requiredErrors.length > 0) {
    return `Conexión establecida, pero faltan permisos requeridos: ${requiredErrors
      .map((check) => check.wsfunction)
      .join(', ')}.`;
  }


  if (requiredSkipped.length > 0) {
    let summary =
      'Conexión correcta. No se detectaron permisos faltantes en las pruebas ejecutadas.';
    summary += ` Algunas validaciones requeridas no se pudieron completar: ${requiredSkipped
      .map((check) => check.wsfunction)
      .join(', ')}.`;

    if (optionalErrors.length > 0) {
      summary += ` Funciones opcionales no disponibles: ${optionalErrors
        .map((check) => check.wsfunction)
        .join(', ')}.`;
    }

    if (optionalSkipped.length > 0) {
      summary += ` Algunas validaciones opcionales no se pudieron completar: ${optionalSkipped
        .map((check) => check.wsfunction)
        .join(', ')}.`;
    }

    return summary;
  }

  let summary = 'Conexión correcta y permisos requeridos OK.';

  if (optionalErrors.length > 0) {
    summary += ` Funciones opcionales no disponibles: ${optionalErrors
      .map((check) => check.wsfunction)
      .join(', ')}.`;
  }

  if (optionalSkipped.length > 0) {
    summary += ` Algunas validaciones opcionales no se pudieron completar: ${optionalSkipped
      .map((check) => check.wsfunction)
      .join(', ')}.`;
  }

  return summary;
}

/** GET /api/platforms – List all platforms (tokens masked) */
router.get('/', (_req, res) => {
  try {
    const platforms = readPlatformConfig();
    const masked = platforms.map((p, i) => ({
      id: i,
      name: p.name,
      slug: slugifyPlatform(p.name || p.url || `platform-${i}`),
      url: normalizeUrl(p.url),
      source: normalizeUrl(p.url),
      token: p.token ? `${p.token.substring(0, 6)}...${p.token.slice(-4)}` : '',
      hasToken: !!p.token,
      monthlyCharge: p.monthlyCharge,
      costPerGb: GLOBAL_COST_PER_GB,
      currency: p.currency,
      isActive: normalizeIsActive(p.isActive),
      hasFinancialConfig: hasFinancialConfig(p),
    }));
    res.json(masked);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/platforms – Add a new platform */
router.post('/', (req, res) => {
  try {
    const { name, url, token, monthlyCharge, isActive } = req.body;
    const normalizedName = String(name ?? '').trim();
    const normalizedUrl = normalizeUrl(url);
    const normalizedToken = String(token ?? '').trim();
    const parsedMonthlyCharge = normalizeOptionalAmount(monthlyCharge);

    if (!normalizedName || !normalizedUrl || !normalizedToken) {
      return res.status(400).json({ error: 'name, url y token son requeridos.' });
    }
    if (monthlyCharge !== undefined && monthlyCharge !== null && monthlyCharge !== '' && parsedMonthlyCharge === null) {
      return res
        .status(400)
        .json({ error: 'monthlyCharge debe ser un número mayor o igual a 0.' });
    }


    const platforms = readPlatformConfig();

    // Check for duplicate URL
    if (platforms.some((p) => normalizeUrl(p.url) === normalizedUrl)) {
      return res.status(409).json({ error: 'Ya existe una plataforma con esa URL.' });
    }
    platforms.push({
      name: normalizedName,
      url: normalizedUrl,
      token: normalizedToken,
      monthlyCharge: parsedMonthlyCharge,
      currency: normalizeCurrency(),
      isActive: normalizeIsActive(isActive),
    });
    writePlatformConfig(platforms);

    res.status(201).json({ message: 'Plataforma agregada.', count: platforms.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/platforms/:id – Update a platform */
router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const platforms = readPlatformConfig();

    if (id < 0 || id >= platforms.length) {
      return res.status(404).json({ error: 'Plataforma no encontrada.' });
    }

    const { name, url, token, monthlyCharge, isActive, costPerGb, currency } = req.body;

    if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
      const normalizedName = String(name ?? '').trim();
      if (!normalizedName) {
        return res.status(400).json({ error: 'name no puede estar vacío.' });
      }
      platforms[id].name = normalizedName;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'url')) {
      const normalizedUrl = normalizeUrl(url);
      if (!normalizedUrl) {
        return res.status(400).json({ error: 'url no puede estar vacía.' });
      }

      if (
        platforms.some(
          (platform, index) =>
            index !== id && normalizeUrl(platform.url) === normalizedUrl
        )
      ) {
        return res.status(409).json({ error: 'Ya existe una plataforma con esa URL.' });
      }

      platforms[id].url = normalizedUrl;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'token')) {
      const normalizedToken = String(token ?? '').trim();
      if (normalizedToken) {
        platforms[id].token = normalizedToken;
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'monthlyCharge')) {
      if (monthlyCharge === null || monthlyCharge === '') {
        platforms[id].monthlyCharge = null;
      } else {
        const parsedMonthlyCharge = normalizeOptionalAmount(monthlyCharge);
        if (parsedMonthlyCharge === null) {
          return res
            .status(400)
            .json({ error: 'monthlyCharge debe ser un número mayor o igual a 0.' });
        }
        platforms[id].monthlyCharge = parsedMonthlyCharge;
      }
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'isActive')) {
      platforms[id].isActive = normalizeIsActive(isActive);
    }

    platforms[id].currency = normalizeCurrency();

    writePlatformConfig(platforms);
    res.json({ message: 'Plataforma actualizada.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/platforms/:id – Remove a platform */
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const platforms = readPlatformConfig();

    if (id < 0 || id >= platforms.length) {
      return res.status(404).json({ error: 'Plataforma no encontrada.' });
    }

    const removed = platforms.splice(id, 1);
    writePlatformConfig(platforms);
    res.json({ message: `Plataforma "${removed[0].name}" eliminada.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/platforms/:id/test – Test connection to a platform */
router.post('/:id/test', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const platforms = readPlatformConfig();

    if (id < 0 || id >= platforms.length) {
      return res.status(404).json({ error: 'Plataforma no encontrada.' });
    }

    const p = platforms[id];
    const client = new MoodleClient(p.url, p.token);
    let connectionOk = false;

    const requiredChecks = [];
    const optionalChecks = [];

    const categoriesCheck = await runWsCheck({
      label: 'Categorías',
      wsfunction: 'core_course_get_categories',
      required: true,
      execute: () => client.getCategories(),
    });
    requiredChecks.push(toPublicCheck(categoriesCheck));
    connectionOk = connectionOk || categoriesCheck.reachedMoodle;

    const coursesCheck = await runWsCheck({
      label: 'Cursos',
      wsfunction: 'core_course_get_courses',
      required: true,
      execute: () => client.getCourses(),
    });
    requiredChecks.push(toPublicCheck(coursesCheck));
    connectionOk = connectionOk || coursesCheck.reachedMoodle;

    const sampleCourseIds = coursesCheck.status === 'ok' ? pickSampleCourseIds(coursesCheck.data) : [];
    const sampleCourseId = sampleCourseIds[0];

    if (!sampleCourseId) {
      requiredChecks.push(
        makeSkippedCheck(
          'Contenidos del curso',
          'core_course_get_contents',
          true,
          'No se encontraron cursos para validar esta función.'
        )
      );
      requiredChecks.push(
        makeSkippedCheck(
          'Usuarios inscritos',
          'core_enrol_get_enrolled_users',
          true,
          'No se encontraron cursos para validar esta función.'
        )
      );
      requiredChecks.push(
        makeSkippedCheck(
          'Tareas',
          'mod_assign_get_assignments',
          true,
          'No se encontraron cursos para validar esta función.'
        )
      );
      requiredChecks.push(
        makeSkippedCheck(
          'Entregas de tareas',
          'mod_assign_get_submissions',
          true,
          'No se encontraron cursos para validar esta función.'
        )
      );
      optionalChecks.push(
        makeSkippedCheck(
          'Foros',
          'mod_forum_get_forums_by_courses',
          false,
          'No se encontraron cursos para validar esta función opcional.'
        )
      );
      optionalChecks.push(
        makeSkippedCheck(
          'Discusiones de foro',
          'mod_forum_get_forum_discussions',
          false,
          'No se encontraron foros para validar esta función opcional.'
        )
      );
      optionalChecks.push(
        makeSkippedCheck(
          'Posts de discusión',
          'mod_forum_get_discussion_posts',
          false,
          'No se encontraron discusiones para validar esta función opcional.'
        )
      );
    } else {
      const contentsCheck = await runWsCheck({
        label: 'Contenidos del curso',
        wsfunction: 'core_course_get_contents',
        required: true,
        execute: () => client.getCourseContents(sampleCourseId),
      });
      requiredChecks.push(toPublicCheck(contentsCheck));
      connectionOk = connectionOk || contentsCheck.reachedMoodle;

      const enrolledUsersCheck = await runWsCheck({
        label: 'Usuarios inscritos',
        wsfunction: 'core_enrol_get_enrolled_users',
        required: true,
        execute: () => client.getEnrolledUsers(sampleCourseId),
      });
      requiredChecks.push(toPublicCheck(enrolledUsersCheck));
      connectionOk = connectionOk || enrolledUsersCheck.reachedMoodle;

      const backupFilesCheck = await runWsCheck({
        label: 'Archivos de backup del curso',
        wsfunction: 'core_files_get_files',
        required: false,
        execute: () =>
          client.getFiles({
            contextid: -1,
            component: 'backup',
            filearea: 'course',
            itemid: 0,
            filepath: '/',
            filename: '',
            contextlevel: 'course',
            instanceid: sampleCourseId,
          }),
      });
      optionalChecks.push(toPublicCheck(backupFilesCheck));
      connectionOk = connectionOk || backupFilesCheck.reachedMoodle;

      const assignmentsCheck = await runWsCheck({
        label: 'Tareas',
        wsfunction: 'mod_assign_get_assignments',
        required: true,
        execute: () => client.getAssignments(sampleCourseIds),
      });
      requiredChecks.push(toPublicCheck(assignmentsCheck));
      connectionOk = connectionOk || assignmentsCheck.reachedMoodle;

      const sampleAssignmentId =
        assignmentsCheck.status === 'ok' ? findFirstAssignmentId(assignmentsCheck.data) : null;

      if (sampleAssignmentId) {
        const submissionsCheck = await runWsCheck({
          label: 'Entregas de tareas',
          wsfunction: 'mod_assign_get_submissions',
          required: true,
          execute: () => client.getSubmissions([sampleAssignmentId]),
        });
        requiredChecks.push(toPublicCheck(submissionsCheck));
        connectionOk = connectionOk || submissionsCheck.reachedMoodle;
      } else {
        requiredChecks.push(
          makeSkippedCheck(
            'Entregas de tareas',
            'mod_assign_get_submissions',
            true,
            'No se encontraron tareas en los cursos de muestra para validar esta función.'
          )
        );
      }

      const forumsCheck = await runWsCheck({
        label: 'Foros',
        wsfunction: 'mod_forum_get_forums_by_courses',
        required: false,
        execute: () => client.getForumsByCourses(sampleCourseIds),
      });
      optionalChecks.push(toPublicCheck(forumsCheck));
      connectionOk = connectionOk || forumsCheck.reachedMoodle;

      const sampleForumId = forumsCheck.status === 'ok' ? findFirstForumId(forumsCheck.data) : null;

      if (sampleForumId) {
        const forumDiscussionsCheck = await runWsCheck({
          label: 'Discusiones de foro',
          wsfunction: 'mod_forum_get_forum_discussions',
          required: false,
          execute: () => client.getForumDiscussions(sampleForumId),
        });
        optionalChecks.push(toPublicCheck(forumDiscussionsCheck));
        connectionOk = connectionOk || forumDiscussionsCheck.reachedMoodle;

        const sampleDiscussionId =
          forumDiscussionsCheck.status === 'ok'
            ? findFirstDiscussionId(forumDiscussionsCheck.data)
            : null;

        if (sampleDiscussionId) {
          const discussionPostsCheck = await runWsCheck({
            label: 'Posts de discusión',
            wsfunction: 'mod_forum_get_discussion_posts',
            required: false,
            execute: () => client.getDiscussionPosts(sampleDiscussionId),
          });
          optionalChecks.push(toPublicCheck(discussionPostsCheck));
          connectionOk = connectionOk || discussionPostsCheck.reachedMoodle;
        } else {
          optionalChecks.push(
            makeSkippedCheck(
              'Posts de discusión',
              'mod_forum_get_discussion_posts',
              false,
              'No se encontraron discusiones en los foros de muestra para validar esta función opcional.'
            )
          );
        }
      } else {
        optionalChecks.push(
          makeSkippedCheck(
            'Discusiones de foro',
            'mod_forum_get_forum_discussions',
            false,
            'No se encontraron foros en los cursos de muestra para validar esta función opcional.'
          )
        );
        optionalChecks.push(
          makeSkippedCheck(
            'Posts de discusión',
            'mod_forum_get_discussion_posts',
            false,
            'No se encontraron discusiones en los foros de muestra para validar esta función opcional.'
          )
        );
      }
    }

    const requiredErrors = requiredChecks.filter((check) => check.status === 'error');
    const optionalErrors = optionalChecks.filter((check) => check.status === 'error');
    const summary = buildTestSummary(connectionOk, requiredChecks, optionalChecks);

    res.json({
      success: connectionOk && requiredErrors.length === 0,
      connection_ok: connectionOk,
      required_permissions_ok: requiredErrors.length === 0,
      optional_permissions_ok: optionalErrors.length === 0,
      summary,
      error: connectionOk && requiredErrors.length === 0 ? null : summary,
      required_checks: requiredChecks,
      optional_checks: optionalChecks,
    });
  } catch (err) {
    res.json({
      success: false,
      connection_ok: false,
      required_permissions_ok: false,
      optional_permissions_ok: false,
      summary: 'No se pudo completar la validación de la plataforma.',
      error: getErrorMessage(err),
      required_checks: [],
      optional_checks: [],
    });
  }
});

module.exports = router;
