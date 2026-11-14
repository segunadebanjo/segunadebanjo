import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function Catalog() {
  const [list, setList] = useState([]);
  useEffect(() => { api.get('/reports/catalog').then(setList); }, []);
  const cats = [...new Set(list.map((r) => r.category))];
  return (
    <div>
      <div className="page-head"><div><h1>Statutory returns</h1><p className="muted">Every NAICOM return the add-on can prepare from your ERP data.</p></div></div>
      {cats.map((c) => (
        <section key={c}>
          <h2 className="cat">{c}</h2>
          <div className="cards">
            {list.filter((r) => r.category === c).map((r) => (
              <Link key={r.code} to={`/reports/${r.code}`} className="card rep">
                <span className="code">{r.code}</span>
                <b>{r.name}</b>
                <p className="muted small">{r.description}</p>
                <div className="chips">{r.frequencies.map((f) => <span key={f} className="chip">{f}</span>)}</div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
