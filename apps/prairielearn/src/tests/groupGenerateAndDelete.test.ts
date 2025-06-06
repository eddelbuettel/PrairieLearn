import { afterAll, assert, beforeAll, describe, test } from 'vitest';

import * as sqldb from '@prairielearn/postgres';

import * as groupUpdate from '../lib/group-update.js';
import { deleteAllGroups } from '../lib/groups.js';
import { TEST_COURSE_PATH } from '../lib/paths.js';
import { generateAndEnrollUsers } from '../models/enrollment.js';

import * as helperServer from './helperServer.js';

const sql = sqldb.loadSqlEquiv(import.meta.url);
const locals: Record<string, any> = {};

describe('test random groups and delete groups', { timeout: 20_000 }, function () {
  beforeAll(helperServer.before(TEST_COURSE_PATH));

  afterAll(helperServer.after);

  test.sequential('get group-based homework assessment', async () => {
    const result = await sqldb.queryAsync(sql.select_group_work_assessment, []);
    assert.notEqual(result.rows.length, 0);
    assert.notEqual(result.rows[0].id, undefined);
    locals.assessment_id = result.rows[0].id;
  });

  test.sequential('create 500 users', async () => {
    const result = await generateAndEnrollUsers({ count: 500, course_instance_id: '1' });
    assert.equal(result.length, 500);
  });

  test.sequential('randomly assign groups', async () => {
    const user_id = '1';
    const authn_user_id = '1';
    const max_group_size = 10;
    const min_group_size = 10;
    const job_sequence_id = await groupUpdate.randomGroups(
      locals.assessment_id,
      user_id,
      authn_user_id,
      max_group_size,
      min_group_size,
    );
    await helperServer.waitForJobSequenceSuccess(job_sequence_id);
  });

  test.sequential('check groups and users', async () => {
    const groupUserCounts = await sqldb.queryAsync(
      'SELECT count(group_id) FROM group_users GROUP BY group_id',
      [],
    );
    assert.equal(groupUserCounts.rows.length, 50);

    const groupUsers = await sqldb.queryAsync('SELECT DISTINCT(user_id) FROM group_users', []);
    assert.equal(groupUsers.rows.length, 500);
  });

  test.sequential('delete groups', async () => {
    await deleteAllGroups(locals.assessment_id, '1');

    const groups = await sqldb.queryAsync(
      'SELECT deleted_at FROM groups WHERE deleted_at IS NULL',
      [],
    );
    assert.equal(groups.rows.length, 0);

    const groupUsers = await sqldb.queryAsync('SELECT * FROM group_users', {});
    assert.equal(groupUsers.rows.length, 0);
  });
});
