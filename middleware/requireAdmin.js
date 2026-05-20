const requireAdmin = (req, res, next) => {
const adminEmail = "abubakriluqman7@gmail.com";

  if (!req.user?.email) {
    return res.status(403).send({ message: "Forbidden" });
  }

  if (req.user.email.toLowerCase() !== adminEmail.toLowerCase()) {
    return res.status(403).send({ message: "Forbidden" });
  }

  next();
};

module.exports = requireAdmin;

