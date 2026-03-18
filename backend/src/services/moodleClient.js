const axios = require('axios');

/**
 * Generic Moodle Web Service REST client.
 * All calls go through POST to {url}/webservice/rest/server.php
 */
class MoodleClient {
  constructor(url, token) {
    this.baseUrl = url.replace(/\/+$/, '');
    this.token = token;
    this.endpoint = `${this.baseUrl}/webservice/rest/server.php`;
  }

  /** Execute a WS function and return the parsed JSON response. */
  async call(wsfunction, params = {}) {
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
      throw new Error(
        `Moodle WS error [${wsfunction}]: ${res.data.message || res.data.exception}`
      );
    }
    return res.data;
  }

  /* ─── Course functions ─── */

  async getCategories() {
    return this.call('core_course_get_categories');
  }

  async getCourses() {
    return this.call('core_course_get_courses');
  }

  async getCourseContents(courseId) {
    return this.call('core_course_get_contents', { courseid: courseId });
  }

  /* ─── Enrolment ─── */

  async getEnrolledUsers(courseId) {
    return this.call('core_enrol_get_enrolled_users', { courseid: courseId });
  }

  /* ─── Assignments ─── */

  async getAssignments(courseIds) {
    const params = {};
    courseIds.forEach((id, i) => {
      params[`courseids[${i}]`] = id;
    });
    return this.call('mod_assign_get_assignments', params);
  }

  async getSubmissions(assignmentIds) {
    const params = {};
    assignmentIds.forEach((id, i) => {
      params[`assignmentids[${i}]`] = id;
    });
    return this.call('mod_assign_get_submissions', params);
  }

  /* ─── Files ─── */

  async getFiles({
    contextid = -1,
    component = '',
    filearea = '',
    itemid = 0,
    filepath = '/',
    filename = '',
    modified = null,
    contextlevel = null,
    instanceid = null,
  } = {}) {
    const params = {
      contextid,
      component,
      filearea,
      itemid,
      filepath,
      filename,
    };

    if (modified !== null && modified !== undefined) {
      params.modified = modified;
    }
    if (contextlevel !== null && contextlevel !== undefined && contextlevel !== '') {
      params.contextlevel = contextlevel;
    }
    if (instanceid !== null && instanceid !== undefined && instanceid !== '') {
      params.instanceid = instanceid;
    }

    return this.call('core_files_get_files', params);
  }

  /* ─── Forums ─── */

  async getForumsByCourses(courseIds) {
    const params = {};
    courseIds.forEach((id, i) => {
      params[`courseids[${i}]`] = id;
    });
    return this.call('mod_forum_get_forums_by_courses', params);
  }

  async getForumDiscussions(forumId, sortorder = -1, page = 0, perpage = 100) {
    return this.call('mod_forum_get_forum_discussions', {
      forumid: forumId,
      sortorder,
      page,
      perpage,
    });
  }

  async getDiscussionPosts(discussionId) {
    return this.call('mod_forum_get_discussion_posts', {
      discussionid: discussionId,
    });
  }
}

module.exports = MoodleClient;
