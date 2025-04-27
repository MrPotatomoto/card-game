// routes/lobby.js
import express from "express"
import GameSession from "../models/GameSession.js"

const router = express.Router()

// Middleware to ensure the user is authenticated.
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next()
  res.redirect("/login")
}

// Lobby page – display active game sessions
router.get("/lobby", isAuthenticated, async (req, res) => {
  // Accept query parameters "status" and "sortBy"
  const { status, sortBy } = req.query

  let query = GameSession.find()

  // When a status filter is provided, only look for that status.
  if (status && status.trim() !== "") {
    query = query.where("status").equals(status)
  }

  // Handle sorting based on a provided sortBy value.
  if (sortBy) {
    // Supported sort options:
    // dateDesc: Newest first, dateAsc: Oldest first
    // nameAsc: Name A-Z, nameDesc: Name Z-A
    if (sortBy === "dateAsc") {
      query = query.sort({ createdAt: 1 })
    } else if (sortBy === "dateDesc") {
      query = query.sort({ createdAt: -1 })
    } else if (sortBy === "nameAsc") {
      query = query.sort({ name: 1 })
    } else if (sortBy === "nameDesc") {
      query = query.sort({ name: -1 })
    }
  } else {
    // Default: Newest first
    query = query.sort({ createdAt: -1 })
  }

  try {
    const activeGames = await query.exec()
    res.render("lobby", {
      user: req.user,
      activeGames,
      filter: status || "",
      sortBy: sortBy || "dateDesc",
    })
  } catch (err) {
    console.error(err)
    req.flash("error", "Unable to load game sessions.")
    res.render("lobby", {
      user: req.user,
      activeGames: [],
      filter: status || "",
      sortBy: sortBy || "dateDesc",
    })
  }
})

// GET route for the "Create Game" page
router.get("/create-game", isAuthenticated, (req, res) => {
  res.render("create-game", { user: req.user })
})

// POST route to create a new game session.
router.post("/create-game", isAuthenticated, async (req, res) => {
  const { name } = req.body
  try {
    const gameSession = await GameSession.create({
      name,
      createdBy: req.user._id,
    })
    // Broadcast the new game session to all connected clients.
    const io = req.app.get("io")
    io.emit("gameCreated", gameSession)
    req.flash("success", "Game session created.")
    res.redirect("/lobby")
  } catch (err) {
    console.error(err)
    req.flash("error", "Failed to create game session.")
    res.redirect("/create-game")
  }
})

router.post("/end-game/:id", isAuthenticated, async (req, res) => {
  const gameId = req.params.id
  try {
    // Remove the game session from the database
    await GameSession.findByIdAndDelete(gameId)

    // Broadcast the removal to all connected clients
    const io = req.app.get("io")
    io.emit("gameRemoved", gameId)

    req.flash("success", "Game session ended.")
    res.redirect("/lobby")
  } catch (err) {
    console.error(err)
    req.flash("error", "Unable to end game session.")
    res.redirect("/lobby")
  }
})

router.post("/update-game/:id", isAuthenticated, async (req, res) => {
  const gameId = req.params.id
  const { status } = req.body // Expecting status to be 'waiting', 'in-progress', 'finished'

  try {
    const updatedGame = await GameSession.findByIdAndUpdate(
      gameId,
      { status },
      { new: true }
    )
    const io = req.app.get("io")
    io.emit("gameUpdated", updatedGame)

    req.flash("success", "Game session updated.")
    res.redirect("/lobby")
  } catch (err) {
    console.error(err)
    req.flash("error", "Unable to update game session.")
    res.redirect("/lobby")
  }
})

export default router
