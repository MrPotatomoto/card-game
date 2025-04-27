// index.js
import express from "express"
import path from "path"
import { fileURLToPath } from "url"
import mongoose from "mongoose"
import session from "express-session"
import { RedisStore } from "connect-redis"
import { createClient } from "redis"
import passport from "passport"
import { Strategy as LocalStrategy } from "passport-local"
import expressLayouts from "express-ejs-layouts"
import flash from "connect-flash"
import User from "./models/User.js"

// Import routes.
import authRoutes from "./routes/auth.js"
import lobbyRoutes from "./routes/lobby.js"
import gameRoutes from "./routes/game.js"
import deckBuilderRoutes from "./routes/deckBuilder.js"
import gameSelectionRoutes from "./routes/gameSelection.js"
import myDecksRoutes from "./routes/myDecks.js"

// Import our game logic.
import { Game } from "./game/gameState.js"

// For Socket.IO chat.
import { Server as SocketIOServer } from "socket.io"
import ChatMessage from "./models/ChatMessage.js"
import sanitizeHtml from "sanitize-html"
import Card from "./models/Card.js"

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// MongoDB connection.
mongoose
  .connect("mongodb://localhost:27017/cardgame", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected."))
  .catch((err) => console.error("MongoDB connection error:", err))

// Redis client setup.
const redisClient = createClient()
redisClient.on("error", (err) => console.error("Redis error:", err))
await redisClient.connect()

// Session configuration with RedisStore.
app.use(
  session({
    store: new RedisStore({ client: redisClient }),
    secret: "yourSecretKey", // Use a strong secret in production.
    resave: false,
    saveUninitialized: false,
  })
)

// Use flash for storing messages in session.
app.use(flash())

// Middleware to pass flash messages to all views.
app.use((req, res, next) => {
  res.locals.messages = req.flash()
  next()
})

// Initialize Passport for authentication.
app.use(passport.initialize())
app.use(passport.session())

// Make the authenticated user available in all views.
app.use((req, res, next) => {
  res.locals.user = req.user
  next()
})

// Body parser middleware.
app.use(express.urlencoded({ extended: true }))

// Set up EJS with layouts.
app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "views"))
app.use(expressLayouts)
app.set("layout", "layout")

// Serve static files.
app.use(express.static(path.join(__dirname, "public")))

// Passport Local Strategy configuration.
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await User.findOne({ username })
      if (!user) return done(null, false, { message: "Incorrect username." })
      const isMatch = await user.comparePassword(password)
      if (!isMatch) return done(null, false, { message: "Incorrect password." })
      return done(null, user)
    } catch (err) {
      return done(err)
    }
  })
)

passport.serializeUser((user, done) => {
  done(null, user.id)
})
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id)
    done(null, user)
  } catch (err) {
    done(err)
  }
})

// Mount routes.
app.use("/", authRoutes)
app.use("/", lobbyRoutes)
app.use("/", gameRoutes)
app.use("/", deckBuilderRoutes)
app.use("/", gameSelectionRoutes)
app.use("/", myDecksRoutes)

app.get("/convertImgUrls", async (req, res) => {
  const convertToPathString = (sample) => {
    if (!sample) return
    sample = sample.replace(/\s+/g, "-").toLowerCase()
    return sample
  }
  const cards = await Card.find({})

  for (let card of cards) {
    let tempUrl = "/img/cards/"

    tempUrl += convertToPathString(card.set) + "/"

    if (card.type === "Ally" || card.type === "Personality") {
      tempUrl += convertToPathString(card.name) + "-"
      tempUrl += convertToPathString(card.title)
    } else {
      tempUrl += convertToPathString(card.name)
    }

    // figure out img extension
    if (
      card.set === "Celestial Tournament" ||
      card.set === "Escalataion" ||
      card.set === "Fusion" ||
      card.set === "Legends" ||
      card.set === "Revelation" ||
      card.set === "Showdown" ||
      card.set === "The Movie Collection 2"
    ) {
      tempUrl += ".png"
    } else {
      tempUrl += ".jpg"
    }

    card.img_url = tempUrl
    await card.save()
  }

  res.send("All done!")
})

// Create HTTP server and start listening.
const server = app.listen(3000, () => {
  console.log("Server listening on port 3000")
})

// Set up Socket.IO.
const io = new SocketIOServer(server)
app.set("io", io)

// In-memory store for active games, keyed by roomId.
const activeGames = {}

// Socket.IO connection handling.
io.on("connection", (socket) => {
  console.log(`New client connected: ${socket.id}`)

  // When a client joins a game room.
  // This event now serves dual purposes: updating chat active users and managing game instances.
  socket.on("joinGame", async (gameId, userName) => {
    socket.join(gameId)
    socket.gameId = gameId
    socket.userName = userName

    // --- Chat Integration (using Redis) ---
    try {
      const redisKey = `game:${gameId}:activeUsers`
      // Remove any previous instance and add the current user.
      await redisClient.sRem(redisKey, userName)
      await redisClient.sAdd(redisKey, userName)
      await redisClient.expire(redisKey, 60 * 60) // 1 hour TTL.

      // Retrieve the updated user list and emit to room.
      const users = await redisClient.sMembers(redisKey)
      io.to(gameId).emit("userList", users)

      // Emit a system chat message.
      io.to(gameId).emit("chatMessage", {
        user: "System",
        message: `${userName} has joined the game.`,
        time: new Date().toLocaleTimeString(),
      })

      // Send previous chat messages to the newly joined client.
      const previousMessages = await ChatMessage.find({ game: gameId }).sort({
        time: 1,
      })
      socket.emit("previousMessages", previousMessages)
    } catch (err) {
      console.error("Error joining game room:", err)
    }

    // --- Game State Integration ---
    // If a game instance doesn't exist for this room, create one.
    if (!activeGames[gameId]) {
      // For demonstration, we create a new game instance with the joining client as the first player.
      // In your full implementation, you'll gather all players before starting the game.
      activeGames[gameId] = new Game(
        [{ id: socket.id, name: userName, deck: [] }],
        gameId
      )
      activeGames[gameId].setupGame() // This shuffles decks, draws initial hands, etc.
    } else {
      // If the game exists, add the new player into the game's state.
      activeGames[gameId].players.push({
        id: socket.id,
        name: userName,
        deck: [],
      })
      // (For a more robust solution, you’d check for duplicates or handle reconnections.)
    }

    // Broadcast the updated game status to all clients in the room.
    io.to(gameId).emit("gameUpdate", {
      phase: activeGames[gameId].phase,
      currentPlayer: activeGames[gameId].getCurrentPlayer().name,
      message: `${userName} joined the game.`,
    })
  })

  // When a client sends a player action (e.g., play a card, end phase, resolve combat).
  socket.on("playerAction", (data) => {
    const roomId = data.roomId
    if (!activeGames[roomId]) {
      console.log(`No game found in room ${roomId}`)
      return
    }
    const game = activeGames[roomId]
    const result = game.processAction(data) // Process action based on our game logic.
    // Emit updated game state to all clients in the room.
    io.to(roomId).emit("gameUpdate", {
      phase: game.phase,
      currentPlayer: game.getCurrentPlayer().name,
      message: `${data.playerName} performed action ${data.type}.`,
    })
  })

  // Chat message handling (remains unchanged).
  socket.on("chatMessage", async (data) => {
    let { gameId, userName, message } = data
    message = sanitizeHtml(message, { allowedTags: [], allowedAttributes: {} })
    message = message.replace(/:\)/g, "😊")
    const msgObj = {
      game: gameId,
      user: userName,
      message,
      time: new Date(),
    }
    try {
      const savedMsg = await ChatMessage.create(msgObj)
      io.to(gameId).emit("chatMessage", {
        user: savedMsg.user,
        message: savedMsg.message,
        time: savedMsg.time.toLocaleTimeString(),
      })
    } catch (err) {
      console.error("Error saving chat message:", err)
    }
  })

  // Typing indicator events.
  socket.on("userTyping", (gameId, userName) => {
    socket.to(gameId).emit("userTyping", userName)
  })
  socket.on("stopTyping", (gameId, userName) => {
    socket.to(gameId).emit("stopTyping", userName)
  })

  // Handle client disconnect.
  socket.on("disconnect", async () => {
    const { gameId, userName } = socket
    if (gameId && userName) {
      try {
        await redisClient.sRem(`game:${gameId}:activeUsers`, userName)
        const updatedUsers = await redisClient.sMembers(
          `game:${gameId}:activeUsers`
        )
        io.to(gameId).emit("userList", updatedUsers)
        io.to(gameId).emit("chatMessage", {
          user: "System",
          message: `${userName} has left the game.`,
          time: new Date().toLocaleTimeString(),
        })
      } catch (err) {
        console.error("Error during disconnect:", err)
      }
    }
    console.log("Client disconnected:", socket.id)
  })
})
