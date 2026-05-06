import { useState } from 'react';

/**
 * Original scenario — sends a GET to a user-entered service+endpoint and
 * displays the response. Preserved here so the existing routing smoke-tests
 * keep working.
 */
export default function RoutingTest() {
  const [serviceName, setServiceName] = useState('swapi.info');
  const [endpoint, setEndpoint] = useState('/api/people/1');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const testRouting = async () => {
    setLoading(true);
    setResult(null);
    const url = `http://${serviceName}${endpoint}`;
    const startedAt = Date.now();
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      const headers = {};
      response.headers.forEach((v, k) => {
        headers[k] = v;
      });
      setResult({
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers,
        data,
        url,
        latency: Date.now() - startedAt,
      });
    } catch (err) {
      setResult({
        success: false,
        error: err.message,
        errorType: err.name,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p className="scenario-lede">
        Test whether an API request from this UI is correctly routed through the
        namespace.
      </p>

      <div className="form">
        <div className="form-group">
          <label htmlFor="service-name">Service Name:</label>
          <input
            id="service-name"
            data-testid="routing-service-input"
            type="text"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            placeholder="swapi.info"
          />
        </div>

        <div className="form-group">
          <label htmlFor="endpoint">Endpoint:</label>
          <input
            id="endpoint"
            data-testid="routing-endpoint-input"
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="/api/people/1"
          />
        </div>

        <button
          type="button"
          data-testid="routing-submit"
          onClick={testRouting}
          disabled={loading}
          className="test-button"
        >
          {loading ? 'Testing...' : 'Test API Routing'}
        </button>
      </div>

      {result && (
        <div className="results" data-testid="routing-result">
          <h2>Test Results</h2>
          {result.error ? (
            <div className="result-section error" data-testid="routing-error">
              <h3>Error</h3>
              <p>
                <strong>Type:</strong> {result.errorType}
              </p>
              <p>
                <strong>Message:</strong> {result.error}
              </p>
            </div>
          ) : (
            <>
              <div className="result-section">
                <h3>Request Info</h3>
                <div className="info-grid">
                  <div>
                    <strong>URL:</strong> {result.url}
                  </div>
                  <div>
                    <strong>Status:</strong>{' '}
                    <span
                      data-testid="routing-status"
                      className={
                        result.success ? 'status-success' : 'status-error'
                      }
                    >
                      {result.status} {result.statusText}
                    </span>
                  </div>
                  <div>
                    <strong>Latency:</strong> {result.latency}ms
                  </div>
                </div>
              </div>
              <div className="result-section">
                <h3>Response Data</h3>
                <pre
                  className="response-data"
                  data-testid="routing-response-body"
                >
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
