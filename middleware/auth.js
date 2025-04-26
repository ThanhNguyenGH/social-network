exports.isAuthenticated = (req, res, next) => {
  if (req.session.user || req.isAuthenticated()) {
    return next();
  }
  res.redirect('/auth/login');
};