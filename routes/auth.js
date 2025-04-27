// routes/auth.js
import express from "express"
import passport from "passport"
import User from "../models/User.js"

const router = express.Router()

// Home route
router.get("/", (req, res) => {
  res.render("index", { user: req.user })
})

// Signup routes
router.get("/signup", (req, res) => {
  res.render("signup")
})
router.post("/signup", async (req, res) => {
  const { username, password, email } = req.body
  try {
    const user = new User({ username, password, email })
    await user.save()
    req.flash("success", "Signup successful! Please log in.")
    res.redirect("/login")
  } catch (err) {
    console.error(err)
    req.flash("error", "Error during signup. Please try again.")
    res.redirect("/signup")
  }
})

// Login routes
router.get("/login", (req, res) => {
  res.render("login")
})
router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/lobby",
    failureRedirect: "/login",
    failureFlash: true, // Ensure flash messages are set on login failure.
  })
)

// Logout route
router.get("/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err)
    }
    req.flash("success", "You have been logged out.")
    res.redirect("/")
  })
})

export default router
