export function handleError(error, _req, res, _next) {
  console.error('request failed', error);
  if (!res.headersSent) res.status(500).json({ message: 'The server could not complete that request.' });
}
