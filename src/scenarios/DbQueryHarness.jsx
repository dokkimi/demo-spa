import { useState } from 'react';

/**
 * Exercises the full UI → HTTP → DB stack. Drives traffic-tester's catch-all
 * endpoint by posting `{queries: [...]}`; traffic-tester executes the SQL
 * against postgres and returns `{queryResults}`. The backend connection
 * string is injected via a hidden input (populated by the fixture's env
 * vars at build time, or typed manually during development).
 *
 * data-testid selectors here are the stable contract that Dokkimi UI tests
 * use to drive the page — keep them consistent.
 */
const DEFAULT_PG_CONN =
  window.__DOKKIMI_PG_CONN ||
  'postgresql://dokkimi:dokkimi@postgres-db:5432/dokkimi';

const DEFAULT_TT_URL = window.__DOKKIMI_TRAFFIC_TESTER_URL || '/traffic-tester';

async function runQuery(trafficTesterUrl, pgConn, command) {
  const { ok, status, data } = await runAction(trafficTesterUrl, '/query', {
    queries: [{ databaseType: 'postgres', connectionString: pgConn, command }],
  });
  const queryResult =
    data?.queryResults?.[0]?.[0]?.result ?? data?.queryResults?.[0] ?? data;
  return { ok, status, data, queryResult };
}

async function runAction(trafficTesterUrl, path, action) {
  const url = `${trafficTesterUrl}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { ok: response.ok, status: response.status, data };
}

export default function DbQueryHarness() {
  const [trafficTesterUrl, setTrafficTesterUrl] = useState(DEFAULT_TT_URL);
  const [pgConn, setPgConn] = useState(DEFAULT_PG_CONN);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState('');
  const [error, setError] = useState(null);
  const [users, setUsers] = useState(null);
  const [posts, setPosts] = useState(null);
  const [lastCreated, setLastCreated] = useState(null);
  const [chainResult, setChainResult] = useState(null);
  const [parallelResult, setParallelResult] = useState(null);

  const fail = (scope, message) => {
    setError({ scope, message });
    setLoading('');
  };

  const listUsers = async () => {
    setLoading('users');
    setError(null);
    try {
      const { queryResult, ok } = await runQuery(
        trafficTesterUrl,
        pgConn,
        'SELECT id, email, name FROM users ORDER BY id',
      );
      if (!ok) {
        fail('users', 'http request failed');
        return;
      }
      setUsers(Array.isArray(queryResult) ? queryResult : []);
    } catch (err) {
      fail('users', err.message);
      return;
    }
    setLoading('');
  };

  const listPosts = async () => {
    setLoading('posts');
    setError(null);
    try {
      const { queryResult, ok } = await runQuery(
        trafficTesterUrl,
        pgConn,
        'SELECT id, title, body, author_email AS "authorEmail" FROM posts ORDER BY id DESC',
      );
      if (!ok) {
        fail('posts', 'http request failed');
        return;
      }
      setPosts(Array.isArray(queryResult) ? queryResult : []);
    } catch (err) {
      fail('posts', err.message);
      return;
    }
    setLoading('');
  };

  const createPost = async () => {
    setError(null);
    if (!title.trim()) {
      // Deliberate client-side validation so the failure-case Dokkimi test
      // has a stable error message to assert against.
      setError({ scope: 'create', message: 'title is required' });
      return;
    }
    setLoading('create');
    try {
      const sanitizedTitle = title.replace(/'/g, "''");
      const sanitizedBody = body.replace(/'/g, "''");
      const authorEmail = 'alice@example.com';
      const { queryResult, ok } = await runQuery(
        trafficTesterUrl,
        pgConn,
        `INSERT INTO posts (title, body, author_email) VALUES ('${sanitizedTitle}', '${sanitizedBody}', '${authorEmail}') RETURNING id, title, author_email AS "authorEmail"`,
      );
      if (!ok) {
        fail('create', 'http request failed');
        return;
      }
      const created = Array.isArray(queryResult) ? queryResult[0] : null;
      setLastCreated(created);
      setTitle('');
      setBody('');
    } catch (err) {
      fail('create', err.message);
      return;
    }
    setLoading('');
  };

  const runChain = async () => {
    setLoading('chain');
    setError(null);
    setChainResult(null);
    try {
      // traffic-tester forwards a POST to downstream-svc, which then queries
      // postgres and returns the user count. Three observable hops in the
      // interceptor logs: routing-test-ui → traffic-tester → downstream-svc → DB.
      const { ok, data } = await runAction(trafficTesterUrl, '/chain', {
        requests: [
          {
            baseURL: 'http://downstream-svc',
            url: '/inner',
            method: 'POST',
            data: {
              queries: [
                {
                  databaseType: 'postgres',
                  connectionString: pgConn,
                  command: 'SELECT count(*)::int AS n FROM users',
                },
              ],
            },
          },
        ],
      });
      if (!ok) {
        fail('chain', 'chain request failed');
        return;
      }
      const count =
        data?.results?.[0]?.queryResults?.[0]?.[0]?.result?.[0]?.n ?? null;
      setChainResult({ count });
    } catch (err) {
      fail('chain', err.message);
      return;
    }
    setLoading('');
  };

  const runParallel = async () => {
    setLoading('parallel');
    setError(null);
    setParallelResult(null);
    try {
      // Fire three independent fetches in parallel — each is its own POST to
      // traffic-tester and shows up as a separate inter-service request log.
      const [u, p, c] = await Promise.all([
        runQuery(
          trafficTesterUrl,
          pgConn,
          'SELECT count(*)::int AS n FROM users',
        ),
        runQuery(
          trafficTesterUrl,
          pgConn,
          'SELECT count(*)::int AS n FROM posts',
        ),
        runQuery(trafficTesterUrl, pgConn, "SELECT 'pong'::text AS pong"),
      ]);
      if (!u.ok || !p.ok || !c.ok) {
        fail('parallel', 'one or more parallel requests failed');
        return;
      }
      setParallelResult({
        users: u.queryResult?.[0]?.n ?? null,
        posts: p.queryResult?.[0]?.n ?? null,
        ping: c.queryResult?.[0]?.pong ?? null,
      });
    } catch (err) {
      fail('parallel', err.message);
      return;
    }
    setLoading('');
  };

  return (
    <div>
      <p className="scenario-lede">
        Drive a Postgres database through traffic-tester. Every button posts a
        SQL command to traffic-tester, which executes it and returns the rows.
      </p>

      <details className="config-block" data-testid="db-config-details">
        <summary>Backend config</summary>
        <div className="form-group">
          <label htmlFor="tt-url">traffic-tester host:</label>
          <input
            id="tt-url"
            data-testid="db-traffic-tester-input"
            type="text"
            value={trafficTesterUrl}
            onChange={(e) => setTrafficTesterUrl(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="pg-conn">postgres connection string:</label>
          <input
            id="pg-conn"
            data-testid="db-pg-conn-input"
            type="text"
            value={pgConn}
            onChange={(e) => setPgConn(e.target.value)}
          />
        </div>
      </details>

      <div className="action-row">
        <button
          type="button"
          className="test-button"
          data-testid="db-list-users"
          onClick={listUsers}
          disabled={loading !== ''}
        >
          {loading === 'users' ? 'Loading users...' : 'List Users'}
        </button>
        <button
          type="button"
          className="test-button"
          data-testid="db-list-posts"
          onClick={listPosts}
          disabled={loading !== ''}
        >
          {loading === 'posts' ? 'Loading posts...' : 'List Posts'}
        </button>
        <button
          type="button"
          className="test-button"
          data-testid="db-run-chain"
          onClick={runChain}
          disabled={loading !== ''}
        >
          {loading === 'chain' ? 'Chaining...' : 'Run Chain'}
        </button>
        <button
          type="button"
          className="test-button"
          data-testid="db-run-parallel"
          onClick={runParallel}
          disabled={loading !== ''}
        >
          {loading === 'parallel' ? 'Running parallel...' : 'Run Parallel'}
        </button>
      </div>

      {chainResult && (
        <div
          className="result-section"
          data-testid="db-chain-result"
          data-user-count={chainResult.count ?? ''}
        >
          <h3>Chain result</h3>
          <p>
            user count via downstream-svc → DB:{' '}
            <strong data-testid="db-chain-user-count">
              {chainResult.count ?? 'n/a'}
            </strong>
          </p>
        </div>
      )}

      {parallelResult && (
        <div className="result-section" data-testid="db-parallel-result">
          <h3>Parallel result</h3>
          <p>
            users:{' '}
            <strong data-testid="db-parallel-users">
              {parallelResult.users ?? 'n/a'}
            </strong>
            {' · '}
            posts:{' '}
            <strong data-testid="db-parallel-posts">
              {parallelResult.posts ?? 'n/a'}
            </strong>
            {' · '}
            ping:{' '}
            <strong data-testid="db-parallel-ping">
              {parallelResult.ping ?? 'n/a'}
            </strong>
          </p>
        </div>
      )}

      <div className="results-grid">
        {users && (
          <div className="result-section" data-testid="db-users-list">
            <h3>Users ({users.length})</h3>
            <ul>
              {users.map((u) => (
                <li
                  key={u.id}
                  data-testid={`db-user-row-${u.id}`}
                  className="user-row"
                >
                  <span data-testid={`db-user-name-${u.id}`}>{u.name}</span>
                  <span className="muted"> · {u.email}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {posts && (
          <div className="result-section" data-testid="db-posts-list">
            <h3>Posts ({posts.length})</h3>
            {posts.length === 0 ? (
              <p className="muted" data-testid="db-posts-empty">
                No posts yet
              </p>
            ) : (
              <ul>
                {posts.map((p) => (
                  <li
                    key={p.id}
                    data-testid={`db-post-row-${p.id}`}
                    className="post-row"
                  >
                    <strong data-testid={`db-post-title-${p.id}`}>
                      {p.title}
                    </strong>
                    <div className="muted">by {p.authorEmail}</div>
                    {p.body ? <p>{p.body}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="result-section">
        <h3>Create Post</h3>
        <div className="form-group">
          <label htmlFor="new-title">Title:</label>
          <input
            id="new-title"
            data-testid="db-create-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Hello Dokkimi"
          />
        </div>
        <div className="form-group">
          <label htmlFor="new-body">Body:</label>
          <input
            id="new-body"
            data-testid="db-create-body"
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="An optional longer body"
          />
        </div>
        <button
          type="button"
          className="test-button"
          data-testid="db-create-submit"
          onClick={createPost}
          disabled={loading !== ''}
        >
          {loading === 'create' ? 'Creating...' : 'Create Post'}
        </button>
        {lastCreated && (
          <p
            className="status-success"
            data-testid="db-create-success"
            data-post-id={lastCreated.id}
          >
            Created post #{lastCreated.id}: {lastCreated.title}
          </p>
        )}
      </div>

      {error && (
        <div
          className="result-section error"
          data-testid={`db-error-${error.scope}`}
        >
          <strong>Error ({error.scope}):</strong> {error.message}
        </div>
      )}
    </div>
  );
}
