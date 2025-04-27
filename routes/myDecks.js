// routes/myDecks.js
import express from "express"
import Deck from "../models/Deck.js"

const router = express.Router()

// Middleware to ensure the user is authenticated.
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next()
  res.redirect("/login")
}

// GET /my-decks: Display all decks built by the current user.
router.get("/my-decks", isAuthenticated, async (req, res) => {
  try {
    const decks = await Deck.find({ user: req.user._id }).sort({ name: 1 })
    res.render("my-decks", { decks })
  } catch (err) {
    console.error("Error retrieving decks:", err)
    req.flash("error", "Error retrieving your decks.")
    res.redirect("/")
  }
})

export default router
