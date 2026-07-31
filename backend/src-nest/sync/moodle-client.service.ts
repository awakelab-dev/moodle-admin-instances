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

  getCategories() {
    return this.call('core_course_get_categories');
  }

  getCourses() {
    return this.call('core_course_get_courses');
  }

  getCourseContents(courseId: number) {
    return this.call('core_course_get_contents', { courseid: courseId });
  }

  getEnrolledUsers(courseId: number) {
    return this.call('core_enrol_get_enrolled_users', { courseid: courseId });
  }

  getGradeItems(courseId: number) {
    return this.call('gradereport_user_get_grade_items', { courseid: courseId });
  }

  getActiveEnrolledUserIds(courseId: number) {
    return this.call('core_enrol_get_enrolled_users', {
      courseid: courseId,
      'options[0][name]': 'onlyactive',
      'options[0][value]': 1,
    });
  }

  getAssignments(courseIds: number[]) {
    const params: Record<string, any> = {};
    courseIds.forEach((id, i) => {
      params[`courseids[${i}]`] = id;
    });
    return this.call('mod_assign_get_assignments', params);
  }

  getSubmissions(assignmentIds: number[]) {
    const params: Record<string, any> = {};
    assignmentIds.forEach((id, i) => {
      params[`assignmentids[${i}]`] = id;
    });
    return this.call('mod_assign_get_submissions', params);
  }

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

  getForumsByCourses(courseIds: number[]) {
    const params: Record<string, any> = {};
    courseIds.forEach((id, i) => {
      params[`courseids[${i}]`] = id;
    });
    return this.call('mod_forum_get_forums_by_courses', params);
  }

  getForumDiscussions(forumId: number, sortorder = -1, page = 0, perpage = 100) {
    return this.call('mod_forum_get_forum_discussions', { forumid: forumId, sortorder, page, perpage });
  }

  getDiscussionPosts(discussionId: number) {
    return this.call('mod_forum_get_discussion_posts', { discussionid: discussionId });
  }
}
