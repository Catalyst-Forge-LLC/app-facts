/**
 * Encode / decode AppFacts viewer payloads for https://appfacts.dev/v#af1.<payload>
 * Payload = zlib-deflate(JSON) as base64url. Keep in sync with generate_app_facts.py
 * and site/v/index.html.
 */
const zlib = require("zlib");

const VIEWER_ORIGIN = "https://appfacts.dev";
const VIEWER_PREFIX = "af1.";
/** Soft cap so phone cameras can still read the QR. */
const MAX_VIEWER_URL_LEN = 1600;

function buildViewerPayload(fm, {
  includeBuild = true,
  includeDepPurpose = true,
  includeServices = true,
  maxDeps = 8,
  maxServices = 6,
} = {}) {
  const deps = (fm.key_dependencies || []).slice(0, maxDeps).map((d) => {
    const item = { n: d.name };
    if (includeDepPurpose && d.purpose) item.p = d.purpose;
    return item;
  });
  const payload = {
    v: 1,
    name: fm.name,
    type: fm.type,
    status: fm.status,
    license: fm.license,
    stack: fm.stack || {},
    deps,
  };
  if (includeServices && Array.isArray(fm.services) && fm.services.length) {
    payload.svc = fm.services.slice(0, maxServices).map((s) => ({
      n: s.name,
      r: s.role,
    }));
  }
  if (includeBuild && fm.build && Object.keys(fm.build).length) {
    const build = {};
    for (const [k, val] of Object.entries(fm.build)) {
      if (val != null && String(val).toLowerCase() !== "unknown") build[k] = val;
    }
    if (Object.keys(build).length) payload.build = build;
  }
  if (fm.homepage) payload.homepage = fm.homepage;
  if (fm.repository) payload.repository = fm.repository;
  return payload;
}

function encodeViewerHash(payload) {
  const json = JSON.stringify(payload);
  const compressed = zlib.deflateSync(Buffer.from(json, "utf8"), { level: 9 });
  return VIEWER_PREFIX + compressed.toString("base64url");
}

function viewerUrlFor(fm) {
  const attempts = [
    { includeBuild: true, includeDepPurpose: true, includeServices: true, maxDeps: 8, maxServices: 6 },
    { includeBuild: false, includeDepPurpose: true, includeServices: true, maxDeps: 8, maxServices: 6 },
    { includeBuild: false, includeDepPurpose: true, includeServices: true, maxDeps: 5, maxServices: 4 },
    { includeBuild: false, includeDepPurpose: false, includeServices: true, maxDeps: 5, maxServices: 4 },
    { includeBuild: false, includeDepPurpose: false, includeServices: false, maxDeps: 3, maxServices: 0 },
  ];
  let url = "";
  for (const opts of attempts) {
    url = `${VIEWER_ORIGIN}/v#${encodeViewerHash(buildViewerPayload(fm, opts))}`;
    if (url.length <= MAX_VIEWER_URL_LEN) return url;
  }
  return url;
}

module.exports = {
  VIEWER_ORIGIN,
  VIEWER_PREFIX,
  buildViewerPayload,
  encodeViewerHash,
  viewerUrlFor,
};
