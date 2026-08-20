import axios from 'axios';

/** Generic Moodle Web Service REST client. All calls go through POST to {url}/webservice/rest/server.php */
export class MoodleClient {
  baseUrl: string;
  token: string;
  endpoint: string;

  constructor(url: string, token: string) {
    this.baseUrl = url.replace(/\/+$/, '');
    this.token = token;
    this.endpoint = `${this.baseUrl}/webservice/rest/server.php`;
  }

  /**
   * Ejecuta una llamada genérica a una wsfunction de Moodle vía POST.
   * Lanza si Moodle responde con una excepción (token sin permisos, función
   * deshabilitada, parámetros inválidos, etc.); el resto de los métodos de
   * esta clase son atajos que llaman a esto con la wsfunction y params fijos.
   */
  async call(wsfunction: string, params: Record<string, any> = {}) {
    const data = new URLSearchParams({
      wstoken: this.token,
      wsfunction,
      moodlewsrestformat: 'json',
      ...params,
    });

    const res = await axios.post(this.endpoint, data.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 60000,
    });

    if (res.data && res.data.exception) {
      throw new Error(`Moodle WS error [${wsfunction}]: ${res.data.message || res.data.exception}`);
    }
    return res.data;
  }

  /** wsfunction: core_course_get_categories. Devuelve el listado plano de categorías de curso (id, name, parent, etc). */
  getCategories() {
    return this.call('core_course_get_categories');
  }

  /** wsfunction: core_course_get_courses. Devuelve todos los cursos de la plataforma (id, fullname, shortname, categoryid, visible...). */
  getCourses() {
    return this.call('core_course_get_courses');
  }

  /** wsfunction: core_course_get_contents. Devuelve las secciones del curso con sus módulos y los archivos embebidos en cada uno. */
  getCourseContents(courseId: number) {
    return this.call('core_course_get_contents', { courseid: courseId });
  }

  /** wsfunction: core_enrol_get_enrolled_users. Devuelve todos los usuarios matriculados en el curso (activos e inactivos). */
  getEnrolledUsers(courseId: number) {
    return this.call('core_enrol_get_enrolled_users', { courseid: courseId });
  }

  /** wsfunction: gradereport_user_get_grade_items. Devuelve las calificaciones (usergrades) de cada alumno matriculado en el curso. */
  getGradeItems(courseId: number) {
    return this.call('gradereport_user_get_grade_items', { courseid: courseId });
  }

  /** wsfunction: core_completion_get_activities_completion_status. Devuelve, por actividad del curso, si un usuario la completó. */
  getActivitiesCompletionStatus(courseId: number, userId: number) {
    return this.call('core_completion_get_activities_completion_status', {
      courseid: courseId,
      userid: userId,
    });
  }

  /**
   * wsfunction: core_enrol_get_enrolled_users, igual que getEnrolledUsers pero
   * filtrando solo matrículas activas. Moodle espera los filtros de "options"
   * como parámetros indexados en el formato options[0][name]/options[0][value]
   * porque la API REST no soporta objetos anidados, solo arrays planos.
   */
  getActiveEnrolledUserIds(courseId: number) {
    return this.call('core_enrol_get_enrolled_users', {
      courseid: courseId,
      'options[0][name]': 'onlyactive',
      'options[0][value]': 1,
    });
  }

  /** wsfunction: mod_assign_get_assignments. Devuelve, agrupadas por curso, las tareas (assignments) de los cursos indicados. */
  getAssignments(courseIds: number[]) {
    const params: Record<string, any> = {};
    courseIds.forEach((id, i) => {
      params[`courseids[${i}]`] = id;
    });
    return this.call('mod_assign_get_assignments', params);
  }

  /** wsfunction: mod_assign_get_submissions. Devuelve las entregas (con sus archivos adjuntos) de las tareas indicadas. */
  getSubmissions(assignmentIds: number[]) {
    const params: Record<string, any> = {};
    assignmentIds.forEach((id, i) => {
      params[`assignmentids[${i}]`] = id;
    });
    return this.call('mod_assign_get_submissions', params);
  }

  /**
   * wsfunction: core_files_get_files. Explorador de archivos de Moodle: dado
   * un nodo (contextid/component/filearea/itemid/filepath) devuelve su
   * listado de hijos (subcarpetas y archivos con su tamaño). Se usa para
   * recorrer el árbol de archivos cuando no hay una wsfunction específica
   * más directa (p. ej. para medir el tamaño de las copias de seguridad).
   */
  getFiles({
    contextid = -1,
    component = '',
    filearea = '',
    itemid = 0,
    filepath = '/',
    filename = '',
    modified = null,
    contextlevel = null,
    instanceid = null,
  }: Record<string, any> = {}) {
    const params: Record<string, any> = { contextid, component, filearea, itemid, filepath, filename };
    if (modified !== null && modified !== undefined) params.modified = modified;
    if (contextlevel !== null && contextlevel !== undefined && contextlevel !== '') params.contextlevel = contextlevel;
    if (instanceid !== null && instanceid !== undefined && instanceid !== '') params.instanceid = instanceid;
    return this.call('core_files_get_files', params);
  }

  /** wsfunction: mod_forum_get_forums_by_courses. Devuelve los foros existentes en los cursos indicados. */
  getForumsByCourses(courseIds: number[]) {
    const params: Record<string, any> = {};
    courseIds.forEach((id, i) => {
      params[`courseids[${i}]`] = id;
    });
    return this.call('mod_forum_get_forums_by_courses', params);
  }

  /** wsfunction: mod_forum_get_forum_discussions. Devuelve las discusiones (hilos) de un foro. */
  getForumDiscussions(forumId: number, sortorder = -1, page = 0, perpage = 100) {
    return this.call('mod_forum_get_forum_discussions', { forumid: forumId, sortorder, page, perpage });
  }

  /** wsfunction: mod_forum_get_discussion_posts. Devuelve los posts de una discusión con sus adjuntos (attachments / imágenes inline). */
  getDiscussionPosts(discussionId: number) {
    return this.call('mod_forum_get_discussion_posts', { discussionid: discussionId });
  }
}
