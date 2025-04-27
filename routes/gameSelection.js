// routes/gameSelection.js
import express from "express"
import Deck from "../models/Deck.js"
import Card from "../models/Card.js"

const router = express.Router()

function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next()
  res.redirect("/login")
}

async function validateDeckServer(deck) {
  let errors = []
  let personalityCards = []
  let masteryCards = []
  let otherCardsCount = 0

  // Loop through each entry in the saved deck.
  for (const entry of deck.cards) {
    const card = await Card.findById(entry.card)
    if (!card) {
      errors.push(`Card with ID ${entry.card} not found.`)
      continue
    }
    // Use the card's limit_per_deck attribute.
    const allowed = card.limit_per_deck
    if (entry.quantity > allowed) {
      errors.push(
        `"${card.name}" may include up to ${allowed} copies (found ${entry.quantity}).`
      )
    }
    // Classify cards by type.
    if (card.type === "Personality") {
      personalityCards.push({ card, quantity: entry.quantity })
    } else if (card.type === "Mastery") {
      masteryCards.push({ card, quantity: entry.quantity })
    } else {
      otherCardsCount += entry.quantity
    }
  }

  // Rule: Exactly 4 Personality cards.
  if (personalityCards.length !== 4) {
    errors.push(
      `Deck must include exactly 4 Personality cards (found ${personalityCards.length}).`
    )
  } else {
    // Verify the presence of levels 1-4.
    const levels = personalityCards.map((pc) => pc.card.card_level)
    ;[1, 2, 3, 4].forEach((level) => {
      if (!levels.includes(level)) {
        errors.push(`Missing Personality card for level ${level}.`)
      }
    })
    // Ensure all personality cards are from the same character.
    const names = personalityCards.map((pc) => pc.card.fullName || pc.card.name)
    const mainPersonalityName = names[0]
    names.forEach((n) => {
      if (n !== mainPersonalityName) {
        errors.push("All Personality cards must be from the same character.")
      }
    })
  }

  // Rule: Exactly one Mastery card.
  if (masteryCards.length !== 1) {
    errors.push(
      `Deck must include exactly one Mastery card (found ${masteryCards.length}).`
    )
  }

  // Rule: The non-Personality, non-Mastery cards must total exactly 60.
  if (otherCardsCount !== 60) {
    errors.push(
      `Deck must have exactly 60 non-Personality, non-Mastery cards (found ${otherCardsCount}).`
    )
  }

  // Determine Main Personality's name and alignment.
  let mainPersonalityName = null
  let mainAlignment = null
  if (personalityCards.length > 0) {
    const mainCard = personalityCards[0].card
    mainPersonalityName = mainCard.fullName || mainCard.name
    mainAlignment = mainCard.alignment
  }

  // Rule: Allies cannot match the Main Personality.
  for (const entry of deck.cards) {
    const card = await Card.findById(entry.card)
    if (card && card.type === "Ally") {
      const allyName = card.fullName || card.name
      if (allyName === mainPersonalityName) {
        errors.push(
          `Ally card "${card.name}" cannot match the Main Personality.`
        )
      }
    }
  }

  // Rule: All styled (non‑Freestyle) cards must match the Mastery's style.
  let masteryStyle = null
  if (masteryCards.length === 1) {
    masteryStyle = masteryCards[0].card.style
  }
  for (const entry of deck.cards) {
    const card = await Card.findById(entry.card)
    if (
      card &&
      card.style !== "Freestyle" &&
      masteryStyle &&
      card.style !== masteryStyle
    ) {
      errors.push(
        `Card "${card.name}" has style "${card.style}" which does not match Mastery's style "${masteryStyle}".`
      )
    }
  }

  // Rule: Named Freestyle cards must have a title that matches the Main Personality's name.
  for (const entry of deck.cards) {
    const card = await Card.findById(entry.card)
    if (
      card &&
      card.style === "Freestyle" &&
      card.title &&
      card.title.trim() !== ""
    ) {
      if (mainPersonalityName && card.title.trim() !== mainPersonalityName) {
        errors.push(
          `Named Freestyle card "${card.name}" has title "${card.title}" which does not match Main Personality "${mainPersonalityName}".`
        )
      }
    }
  }

  // Rule: Alignment check – any card with an alignment other than "None" must match the Main Personality's alignment.
  for (const entry of deck.cards) {
    const card = await Card.findById(entry.card)
    if (
      card &&
      card.alignment !== "None" &&
      mainAlignment &&
      card.alignment !== mainAlignment
    ) {
      errors.push(
        `Card "${card.name}" has alignment "${card.alignment}" which does not match Main Personality alignment "${mainAlignment}".`
      )
    }
  }

  return { valid: errors.length === 0, errors }
}

router.post("/start-game", isAuthenticated, async (req, res) => {
  const { deckId } = req.body
  try {
    const deck = await Deck.findById(deckId)
    if (!deck) {
      req.flash("error", "Deck not found.")
      return res.redirect("/my-decks")
    }
    const result = await validateDeckServer(deck)
    if (!result.valid) {
      req.flash("error", "Deck invalid: " + result.errors.join(" "))
      return res.redirect("/my-decks")
    }
    // If the deck passes validation, proceed to start the game.
    res.redirect(`/game-room?deckId=${deckId}`)
  } catch (err) {
    console.error(err)
    req.flash("error", "Error starting game.")
    res.redirect("/my-decks")
  }
})

export default router
