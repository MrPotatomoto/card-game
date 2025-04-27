// /game/gameState.js
export const GamePhases = {
  SETUP: "setup",
  DRAW: "draw",
  PLANNING: "planning",
  COMBAT: "combat",
  END: "end",
}

export class PlayerState {
  constructor(player, deck) {
    this.player = player // e.g. { id, name }
    this.deck = deck || [] // Array of cards (object IDs or full objects)
    this.hand = [] // Initially empty; will be filled on draw phase
    this.board = [] // Cards played during the Planning/Combat phases
    this.discardPile = [] // Discarded cards
  }
}

export class Game {
  constructor(players, roomId) {
    // players is an array of objects: { id, name, deck }
    // where deck is already arranged from deck builder, for instance.
    this.players = players.map((p) => new PlayerState(p, p.deck))
    this.currentPlayerIndex = 0
    this.phase = GamePhases.SETUP
    this.roomId = roomId // Used for Socket.IO communications
    this.stateData = {} // For generic use (if needed)
    // For example, you might want to store logs or temporary tokens
  }

  // Setup phase: For example shuffle decks and draw initial hands.
  setupGame() {
    this.players.forEach((playerState) => {
      // Shuffle the player's deck (simple shuffle algorithm)
      playerState.deck = this.shuffleArray(playerState.deck)
      // Draw an initial hand – e.g., 5 cards.
      for (let i = 0; i < 5; i++) {
        this.drawCardForPlayer(playerState)
      }
    })
    this.phase = GamePhases.DRAW
    this.notifyPlayers(`Game setup complete. Entering ${this.phase} phase.`)
  }

  // A utility function for shuffling an array.
  shuffleArray(arr) {
    let newArr = arr.slice()
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[newArr[i], newArr[j]] = [newArr[j], newArr[i]]
    }
    return newArr
  }

  // Draw phase: The current player draws a card.
  drawPhase() {
    const currentPlayerState = this.getCurrentPlayerState()
    this.drawCardForPlayer(currentPlayerState)
    this.phase = GamePhases.PLANNING
    this.notifyPlayers(
      `Draw phase complete. Now in ${this.phase} phase for ${
        this.getCurrentPlayer().name
      }.`
    )
  }

  // Utility: Draw a card for a given player state.
  drawCardForPlayer(playerState) {
    if (playerState.deck.length > 0) {
      const card = playerState.deck.shift() // Remove card from deck.
      playerState.hand.push(card) // Add card to hand.
      this.notifyPlayers(`${playerState.player.name} drew a card.`)
      return card
    } else {
      this.notifyPlayers(`${playerState.player.name} has no cards to draw.`)
      return null
    }
  }

  // Transition to next phase; expanded to support our phases.
  nextPhase() {
    switch (this.phase) {
      case GamePhases.DRAW:
        this.phase = GamePhases.PLANNING
        break
      case GamePhases.PLANNING:
        this.phase = GamePhases.COMBAT
        break
      case GamePhases.COMBAT:
        this.phase = GamePhases.END
        break
      case GamePhases.END:
        // End-of-turn: cleanup and switch to next player's turn.
        this.resetPlayerForNextTurn()
        this.currentPlayerIndex =
          (this.currentPlayerIndex + 1) % this.players.length
        this.phase = GamePhases.DRAW
        // At the beginning of the turn, draw a card.
        this.drawPhase()
        return // Early exit so notifyPlayers is done here.
      default:
        break
    }
    this.notifyPlayers(
      `Phase changed to ${this.phase} for ${this.getCurrentPlayer().name}.`
    )
  }

  // Reset temporary values, such as clearing boards or moving played cards to discard.
  resetPlayerForNextTurn() {
    const currentPlayerState = this.getCurrentPlayerState()
    // For example, assume all cards on board go to discard.
    currentPlayerState.discardPile.push(...currentPlayerState.board)
    currentPlayerState.board = []
  }

  // Returns the current player's state.
  getCurrentPlayerState() {
    return this.players[this.currentPlayerIndex]
  }

  // Returns the current player's info.
  getCurrentPlayer() {
    return this.getCurrentPlayerState().player
  }

  // -------------------------------
  // 2. Implementing Action Handling
  // -------------------------------

  // Example: Player plays a card from hand onto board (in Planning phase).
  playCard(playerId, cardId) {
    // Verify the current phase is Planning.
    if (this.phase !== GamePhases.PLANNING) {
      return {
        success: false,
        message: "You can only play cards during the Planning phase.",
      }
    }
    const currentPlayerState = this.getCurrentPlayerState()
    if (currentPlayerState.player.id !== playerId) {
      return { success: false, message: "It is not your turn." }
    }
    // Find card in hand.
    const cardIndex = currentPlayerState.hand.findIndex(
      (card) => card._id === cardId
    )
    if (cardIndex === -1) {
      return { success: false, message: "Card not found in your hand." }
    }
    const card = currentPlayerState.hand.splice(cardIndex, 1)[0]
    // Rule enforcement could be added here (e.g., can only play cards with sufficient mana, etc.)
    currentPlayerState.board.push(card)
    this.notifyPlayers(`${currentPlayerState.player.name} played ${card.name}.`)
    return { success: true, card }
  }

  // Example: Combat resolution - a simplified method.
  resolveCombat() {
    // In a full system, you would compare board cards and calculate damage, etc.
    // For now, simply log a message.
    this.notifyPlayers(
      `Combat resolved for ${this.getCurrentPlayer().name}'s turn.`
    )
    // After combat, move to END phase.
    this.phase = GamePhases.END
    this.notifyPlayers(`Entering ${this.phase} phase.`)
  }

  // A method to process generic player actions.
  processAction(actionData) {
    // actionData could be an object with { playerId, type, cardId, ... }
    // Example structure:
    // { playerId: "p1", type: "playCard", cardId: "card123" }
    let result
    switch (actionData.type) {
      case "playCard":
        result = this.playCard(actionData.playerId, actionData.cardId)
        break
      case "endPhase":
        this.nextPhase()
        result = { success: true }
        break
      case "resolveCombat":
        this.resolveCombat()
        result = { success: true }
        break
      // Additional actions can be handled.
      default:
        result = { success: false, message: "Unknown action type." }
        break
    }
    return result
  }

  // -------------------------------
  // 3. Notify Players (for real-time updates)
  // -------------------------------

  // This function would ideally use Socket.IO to send updates. For now, we simply log.
  notifyPlayers(message) {
    // In your Socket.IO integration, you would do:
    // io.to(this.roomId).emit('gameUpdate', { phase: this.phase, message, currentPlayer: this.getCurrentPlayer().name });
    console.log(`[Game Update][Room ${this.roomId}]: ${message}`)
  }
}
