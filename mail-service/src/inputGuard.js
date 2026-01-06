// Only block script tags; allow normal HTML (needed for email templates)
const UNSAFE_PATTERN = /<\s*\/?\s*script\b/i;

const isSkippable = (value) => {
  if (!value) return true;
  if (Buffer.isBuffer(value)) return true;
  if (typeof value === "function") return true;
  if (typeof value === "object") {
    if (typeof value.pipe === "function") return true;
    if ("path" in value && "size" in value) return true;
  }
  return false;
};

const collectIssues = (value, path, issues, depth = 0) => {
  if (depth > 4) return;
  if (typeof value === "string") {
    if (UNSAFE_PATTERN.test(value)) {
      issues.push(`${path} contains disallowed HTML/script content`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, idx) => collectIssues(entry, `${path}[${idx}]`, issues, depth + 1));
    return;
  }
  if (value && typeof value === "object" && !isSkippable(value)) {
    Object.entries(value).forEach(([key, val]) => collectIssues(val, `${path}.${key}`, issues, depth + 1));
  }
};

export const inputGuard = (req, res, next) => {
  const issues = [];
  collectIssues(req.body, "body", issues);
  collectIssues(req.query, "query", issues);
  collectIssues(req.params, "params", issues);

  if (issues.length) {
    return res.status(400).json({ error: "Invalid input", details: issues.slice(0, 5) });
  }
  return next();
};
