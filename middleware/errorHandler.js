module.exports = (err, req, res, next) => {
  console.error('Error Handler:', err);
  res.status(err.status || 500).render('pages/error', {
    message: err.message || 'An unexpected error occurred.',
    user: req.session.user,
    layout: 'layouts/main'
  });
};