// routes/deckBuilder.js
import express from "express"
import Deck from "../models/Deck.js"
import Card from "../models/Card.js"

const router = express.Router()

function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next()
  res.redirect("/login")
}

// GET /deck-builder: Render deck builder view
router.get("/deck-builder", isAuthenticated, async (req, res) => {
  try {
    // Accept query parameters for filtering, etc.
    const { type, style, name, edit } = req.query
    let query = {}
    if (type && type.trim() !== "") query.type = type
    if (style && style.trim() !== "") query.style = style
    if (name && name.trim() !== "") query.name = { $regex: name, $options: "i" }

    // Find cards that match the filter
    const cards = await Card.find(query).sort({ name: 1 })

    // If there is an edit parameter, load the deck from the database.
    let existingDeck = null
    if (edit) {
      existingDeck = await Deck.findById(edit)
      // Ensure the deck belongs to the logged-in user, if needed.
      if (!existingDeck || String(existingDeck.user) !== String(req.user._id)) {
        req.flash("error", "Unauthorized to edit this deck.")
        return res.redirect("/my-decks")
      }
    }

    res.render("deck-builder", {
      user: req.user,
      cards,
      filter: {
        type: type || "",
        style: style || "",
        name: name || "",
      },
      existingDeck, // Pass existing deck data if editing.
    })
  } catch (err) {
    console.error(err)
    req.flash("error", "Unable to load deck builder.")
    res.redirect("/lobby")
  }
})

export default router
