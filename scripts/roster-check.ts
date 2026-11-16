import Papa from 'papaparse';
import { readFileSync } from 'node:fs';
import { guessMapping, parseRoster, groupFamilies } from '../src/lib/roster';

const csv = readFileSync('/tmp/claude-0/rostertest/sample.csv', 'utf8');
const parsed = Papa.parse<Record<string,string>>(csv, { header: true, skipEmptyLines: true });
const headers = parsed.meta.fields ?? [];

const mapping = guessMapping(headers);
console.log('GUESSED MAPPING:');
for (const [k,v] of Object.entries(mapping)) console.log(`  ${k.padEnd(20)} -> ${v}`);

const result = parseRoster(parsed.data, mapping);
console.log(`\nfamilies=${result.familyCount} parents=${result.parentCount} students=${result.studentCount} skipped=${result.errors.length}`);

console.log('\nSKIPPED ROWS:');
for (const e of result.errors) console.log(`  row ${e.rowNumber}: ${e.reason}`);

console.log('\nFAMILIES:');
for (const f of groupFamilies(result.rows)) {
  console.log(`  ${f.name}`);
  console.log(`    parents:  ${f.parents.map(p=>p.email).join(', ')}`);
  console.log(`    students: ${f.students.map(s=>`${s.firstName} g${s.grade} ${s.division}`).join(' | ')}`);
}
