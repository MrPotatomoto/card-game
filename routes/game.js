// routes/game.js
import express from "express"
import GameSession from "../models/GameSession.js"

const router = express.Router()

function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next()
  res.redirect("/login")
}

router.get("/game/:id", isAuthenticated, async (req, res) => {
  try {
    const gameId = req.params.id
    // Find the game session by its ID
    const game = await GameSession.findById(gameId)
    if (!game) {
      req.flash("error", "Game not found.")
      return res.redirect("/lobby")
    }
    // Render the game room view with the game data
    res.render("game", { user: req.user, game })
  } catch (err) {
    console.error(err)
    req.flash("error", "Error retrieving the game.")
    res.redirect("/lobby")
  }
})

export default router
