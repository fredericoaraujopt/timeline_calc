"use client";

import config from "../calculator/config.json";
import { Calculator } from "../components/Calculator";

export default function Page() {
  return (
    <main className="container">
      <header className="header">
        <div>
          <h1 className="h-title">Connectome timeline calculator</h1>
        </div>
      </header>

      <Calculator />
    </main>
  );
}
