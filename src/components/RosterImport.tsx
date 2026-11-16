'use client';

import { useMemo, useState } from 'react';
import Papa from 'papaparse';
import {
  FIELD_LABELS,
  REQUIRED_FIELDS,
  ROSTER_FIELDS,
  guessMapping,
  parseRoster,
  groupFamilies,
  type RosterField,
} from '@/lib/roster';
import { DIVISION_LABELS } from '@/lib/types';

type Step = 'upload' | 'map' | 'importing' | 'done';

interface ImportResult {
  familiesProcessed: number;
  usersCreated: number;
  usersUpdated: number;
  studentsCreated: number;
  errorCount: number;
  errors: { rowNumber: number; reason: string }[];
}

export function RosterImport() {
  const [step, setStep] = useState<Step>('upload');
  const [filename, setFilename] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<RosterField, string>>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  function handleFile(file: File) {
    setError('');
    setFilename(file.name);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        const cols = (parsed.meta.fields ?? []).filter(Boolean);
        if (cols.length === 0) {
          setError('That file has no column headers in the first row.');
          return;
        }
        setHeaders(cols);
        setRecords(parsed.data);
        setMapping(guessMapping(cols));
        setStep('map');
      },
      error: () => setError('Could not read that file. Is it a .csv?'),
    });
  }

  const preview = useMemo(() => {
    if (records.length === 0) return null;
    const parsed = parseRoster(records, mapping);
    return { ...parsed, families: groupFamilies(parsed.rows) };
  }, [records, mapping]);

  const missingRequired = REQUIRED_FIELDS.filter((f) => !mapping[f]);
  const canImport =
    missingRequired.length === 0 && (preview?.rows.length ?? 0) > 0;

  async function handleImport() {
    setStep('importing');
    setError('');

    try {
      const res = await fetch('/api/admin/roster/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, mapping, records }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Import failed');
      }

      setResult(await res.json());
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
      setStep('map');
    }
  }

  function reset() {
    setStep('upload');
    setHeaders([]);
    setRecords([]);
    setMapping({});
    setResult(null);
    setFilename('');
    setError('');
  }

  // ---------------------------------------------------------------- upload

  if (step === 'upload') {
    return (
      <div>
        <label
          htmlFor="roster-file"
          className="flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-12 text-center transition hover:border-navy hover:bg-navy/[0.02]"
        >
          <span className="font-serif text-lg text-navy">
            Choose a roster file
          </span>
          <span className="mt-1 text-sm text-gray-500">
            A .csv export from FACTS, one row per parent and student
          </span>
          <input
            id="roster-file"
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </label>
        {error && <p className="mt-3 text-sm text-red">{error}</p>}
        <p className="mt-4 text-sm text-gray-500">
          Nothing is saved until you review the preview on the next screen.
          Running an import twice is safe: parents are matched by email and
          students by name and grade, so an updated export updates existing
          records instead of duplicating them.
        </p>
      </div>
    );
  }

  // ------------------------------------------------------------------- done

  if (step === 'done' && result) {
    return (
      <div>
        <h3 className="font-serif text-xl text-navy">Import complete</h3>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Families" value={result.familiesProcessed} />
          <Stat label="Accounts created" value={result.usersCreated} />
          <Stat label="Accounts updated" value={result.usersUpdated} />
          <Stat label="Students added" value={result.studentsCreated} />
        </dl>

        {result.errorCount > 0 && (
          <div className="mt-6 rounded border border-red/30 bg-red/5 p-4">
            <p className="font-semibold text-red">
              {result.errorCount} row{result.errorCount === 1 ? '' : 's'} skipped
            </p>
            <ul className="mt-2 space-y-1 text-sm text-gray-700">
              {result.errors.map((e, i) => (
                <li key={i}>
                  {e.rowNumber > 0 ? `Row ${e.rowNumber}: ` : ''}
                  {e.reason}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-gray-600">
              Fix these in the spreadsheet and import again. Rows that already
              landed will not be duplicated.
            </p>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <a
            href="/admin/invitations"
            className="rounded bg-navy px-4 py-2 font-semibold text-white"
          >
            Go to invitations
          </a>
          <button
            type="button"
            onClick={reset}
            className="rounded border border-gray-300 px-4 py-2 font-semibold text-navy"
          >
            Import another file
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------- map/preview

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h3 className="font-serif text-xl text-navy">Match your columns</h3>
        <button
          type="button"
          onClick={reset}
          className="text-sm text-gray-500 underline underline-offset-2"
        >
          Start over
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        {filename} · {records.length} rows
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {ROSTER_FIELDS.map((field) => (
          <div key={field}>
            <label
              htmlFor={`map-${field}`}
              className="block text-sm font-semibold text-navy"
            >
              {FIELD_LABELS[field]}
              {REQUIRED_FIELDS.includes(field) && (
                <span className="ml-1 text-red">*</span>
              )}
            </label>
            <select
              id={`map-${field}`}
              value={mapping[field] ?? ''}
              onChange={(e) =>
                setMapping((m) => ({
                  ...m,
                  [field]: e.target.value || undefined,
                }))
              }
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Not in this file</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {preview && (
        <div className="mt-8">
          <h4 className="font-serif text-lg text-navy">Preview</h4>
          <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Families" value={preview.familyCount} />
            <Stat label="Parents" value={preview.parentCount} />
            <Stat label="Students" value={preview.studentCount} />
            <Stat
              label="Rows skipped"
              value={preview.errors.length}
              tone={preview.errors.length > 0 ? 'warn' : 'normal'}
            />
          </dl>

          {preview.families.length > 0 && (
            <div className="mt-5 overflow-hidden rounded border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Family</th>
                    <th className="px-3 py-2">Parents</th>
                    <th className="px-3 py-2">Students</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.families.slice(0, 8).map((f) => (
                    <tr key={f.key}>
                      <td className="px-3 py-2 font-medium text-navy">
                        {f.name}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {f.parents.map((p) => p.email).join(', ')}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {f.students
                          .map(
                            (s) =>
                              `${s.firstName} (${s.grade}, ${
                                DIVISION_LABELS[s.division]
                              })`,
                          )
                          .join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.families.length > 8 && (
                <p className="bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  Showing 8 of {preview.families.length} families.
                </p>
              )}
            </div>
          )}

          {preview.errors.length > 0 && (
            <details className="mt-4 rounded border border-amber-300 bg-amber-50 p-4">
              <summary className="cursor-pointer font-semibold text-amber-900">
                {preview.errors.length} row
                {preview.errors.length === 1 ? '' : 's'} will be skipped
              </summary>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {preview.errors.slice(0, 25).map((e) => (
                  <li key={e.rowNumber}>
                    Row {e.rowNumber}: {e.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {missingRequired.length > 0 && (
        <p className="mt-5 rounded bg-red/5 p-3 text-sm text-red">
          Still need a column for:{' '}
          {missingRequired.map((f) => FIELD_LABELS[f]).join(', ')}
        </p>
      )}

      {error && <p className="mt-4 text-sm text-red">{error}</p>}

      <button
        type="button"
        disabled={!canImport || step === 'importing'}
        onClick={handleImport}
        className="mt-6 rounded bg-navy px-5 py-2.5 font-semibold text-white disabled:opacity-50"
      >
        {step === 'importing'
          ? 'Importing…'
          : `Import ${preview?.familyCount ?? 0} families`}
      </button>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'normal',
}: {
  label: string;
  value: number;
  tone?: 'normal' | 'warn';
}) {
  return (
    <div className="rounded border border-gray-200 px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd
        className={`font-serif text-2xl ${
          tone === 'warn' && value > 0 ? 'text-red' : 'text-navy'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
