import { searchMaterials } from "./api";

// Single network entry point for the material-recommendation feature. Call
// this only on an explicit user action (a "Find local materials" click) —
// never on redraw, keystroke, or country-change alone. The server caches by
// country+category, so repeated requests across users stay cheap as long as
// the frontend keeps this contract of "one explicit request per lookup".
export async function findMaterials({ country, category, quantity, unit }) {
  const res = await searchMaterials({ country, category, quantity, unit });
  return res.materials || [];
}
