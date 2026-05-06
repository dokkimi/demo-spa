import { useState } from 'react';
import './App.css';
import RoutingTest from './scenarios/RoutingTest.jsx';
import DbQueryHarness from './scenarios/DbQueryHarness.jsx';

const SCENARIOS = [
  { id: 'routing', label: 'Routing Test' },
  { id: 'db', label: 'DB Query Harness' },
];

function App() {
  const [scenario, setScenario] = useState('routing');

  return (
    <div className="app">
      <div className="container">
        <h1>Dokkimi Test Fixture</h1>
        <p className="subtitle">
          Scenarios for exercising namespace routing, traffic interception, and
          UI e2e correlation.
        </p>

        <nav className="tabs" data-testid="scenario-nav">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`tab ${scenario === s.id ? 'tab-active' : ''}`}
              data-testid={`tab-${s.id}`}
              onClick={() => setScenario(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <section data-testid={`scenario-${scenario}`}>
          {scenario === 'routing' && <RoutingTest />}
          {scenario === 'db' && <DbQueryHarness />}
        </section>
      </div>
    </div>
  );
}

export default App;
