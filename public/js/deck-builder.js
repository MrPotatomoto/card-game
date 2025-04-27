// Define localStorage key (if you're persisting deck state)
const LOCAL_STORAGE_KEY = "deckCards"
// Global deckCards array to hold the current deck.
let deckCards = []

// Save current deck state to localStorage.
function saveDeckState() {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(deckCards))
}

// Load deck state from localStorage.
function loadDeckState() {
  const savedState = localStorage.getItem(LOCAL_STORAGE_KEY)
  if (savedState) {
    try {
      deckCards = JSON.parse(savedState)
      updateDeckList()
    } catch (err) {
      console.error("Error parsing saved deck state:", err)
      deckCards = []
    }
  }
}
window.addEventListener("DOMContentLoaded", loadDeckState)

// Build mapping for each card's data details from the card-grid.
const cardDetails = {}
document.querySelectorAll(".card-item").forEach((item) => {
  const id = item.getAttribute("data-card-id")
  cardDetails[id] = {
    limit: parseInt(item.getAttribute("data-card-limit"), 10) || 3,
    type: item.getAttribute("data-card-type"),
    style: item.getAttribute("data-card-style"),
    pur: parseFloat(item.getAttribute("data-card-pur")) || 0,
    title: item.getAttribute("data-card-title"),
    alignment: item.getAttribute("data-card-alignment") || "None",
    level: item.getAttribute("data-card-level")
      ? parseInt(item.getAttribute("data-card-level"), 10)
      : null,
    img: item.querySelector("img") ? item.querySelector("img").src : "", // Save image URL if available
  }
})

// When an add button is clicked, add the corresponding card to the deck.
document.querySelectorAll(".add-card-btn").forEach((button) => {
  button.addEventListener("click", function (e) {
    e.stopPropagation()
    const cardItem = button.parentElement
    const cardId = cardItem.getAttribute("data-card-id")
    const cardName = cardItem.getAttribute("data-card-name")
    const cardType = cardItem.getAttribute("data-card-type")
    let level = null
    if (cardType === "Personality") {
      level = parseInt(cardItem.getAttribute("data-card-level"), 10)
    }
    // Check if card already exists in deckCards.
    const existing = deckCards.find(
      (card) =>
        card.cardId === cardId && (card.level === level || level === null)
    )
    if (existing) {
      existing.quantity++
    } else {
      deckCards.push({
        cardId,
        name: cardName,
        quantity: 1,
        level,
        type: cardType,
        style: cardDetails[cardId].style,
        pur: cardDetails[cardId].pur,
        title: cardDetails[cardId].title,
      })
    }
    updateDeckList()
  })
})

// Function to update the sidebar deck list.
function updateDeckList() {
  const sidebarDiv = document.getElementById("sidebarDeckList")
  sidebarDiv.innerHTML = ""

  // Group deckCards by card type.
  const groups = {}
  deckCards.forEach((card) => {
    if (!groups[card.type]) groups[card.type] = []
    groups[card.type].push(card)
  })

  // Create a header and list for each type.
  for (const type in groups) {
    let header = document.createElement("h4")
    header.textContent = type
    sidebarDiv.appendChild(header)

    groups[type].forEach((card) => {
      let row = document.createElement("div")
      row.className = "sidebar-card-row"
      row.textContent = `${card.name} x ${card.quantity}`
      // On mouseover, update the preview pane to show the card's image.
      row.addEventListener("mouseover", () => {
        const preview = document.getElementById("previewImage")
        const imgUrl = cardDetails[card.cardId].img
        preview.src = imgUrl || ""
      })
      // Optionally, clear the preview on mouse out.
      row.addEventListener("mouseout", () => {
        const preview = document.getElementById("previewImage")
        preview.src = "/img/card-back.jpg"
      })
      sidebarDiv.appendChild(row)
    })
  }

  // Update the hidden field with the current deck state.
  document.getElementById("cardData").value = JSON.stringify(deckCards)

  // Run deck validation.
  const result = validateDeck(deckCards)
  const validationDiv = document.getElementById("deckValidation")
  if (result.valid) {
    validationDiv.innerHTML = `<span style="color: green;">Deck is valid.</span>`
  } else {
    validationDiv.innerHTML = result.errors
      .map((err) => `<div style="color: red;">${err}</div>`)
      .join("")
  }

  // Save state for persistence.
  saveDeckState()
}

// Existing validateDeck function remains unchanged.
function validateDeck(deckCards) {
  let errors = []
  let personalityCards = []
  let masteryCards = []
  let otherCardsCount = 0

  deckCards.forEach((card) => {
    const details = cardDetails[card.cardId]
    const allowed = details.limit
    if (card.quantity > allowed) {
      errors.push(
        `"${card.name}" may include up to ${allowed} copies (found ${card.quantity}).`
      )
    }
    if (details.type === "Personality") {
      personalityCards.push(card)
    } else if (details.type === "Mastery") {
      masteryCards.push(card)
    } else {
      otherCardsCount += card.quantity
    }
  })

  if (personalityCards.length !== 4) {
    errors.push(
      `Deck must include exactly 4 Personality cards (found ${personalityCards.length}).`
    )
  } else {
    const levels = personalityCards.map((pc) => pc.level)
    ;[1, 2, 3, 4].forEach((level) => {
      if (!levels.includes(level)) {
        errors.push(`Missing Personality card for level ${level}.`)
      }
    })
    const names = personalityCards.map((pc) => pc.name)
    const mainPersonalityName = names[0]
    names.forEach((n) => {
      if (n !== mainPersonalityName) {
        errors.push("All Personality cards must belong to the same character.")
      }
    })
  }

  if (masteryCards.length !== 1) {
    errors.push(
      `Deck must include exactly 1 Mastery card (found ${masteryCards.length}).`
    )
  }
  if (otherCardsCount !== 60) {
    errors.push(
      `Deck must have exactly 60 non-Personality, non-Mastery cards (found ${otherCardsCount}).`
    )
  }

  let mainPersonalityName = personalityCards.length
    ? personalityCards[0].name
    : null
  let mainPersonalityAlignment = personalityCards.length
    ? cardDetails[personalityCards[0].cardId].alignment
    : null

  deckCards.forEach((card) => {
    const details = cardDetails[card.cardId]
    if (details.type === "Ally" && card.name === mainPersonalityName) {
      errors.push(
        `Ally "${card.name}" cannot be included because it matches Main Personality.`
      )
    }
  })

  let masteryStyle = null
  if (masteryCards.length === 1) {
    masteryStyle = cardDetails[masteryCards[0].cardId].style
  }
  deckCards.forEach((card) => {
    const details = cardDetails[card.cardId]
    if (
      details.style !== "Non-Styled" &&
      masteryStyle &&
      details.style !== masteryStyle
    ) {
      errors.push(
        `Card "${card.name}" has style "${details.style}" which does not match Mastery's style "${masteryStyle}".`
      )
    }
  })

  deckCards.forEach((card) => {
    const details = cardDetails[card.cardId]
    if (
      details.style === "Freestyle" &&
      details.title &&
      details.title.trim() !== "" &&
      details.title.trim() !== mainPersonalityName
    ) {
      errors.push(
        `Named Freestyle card "${card.name}" has title "${details.title}" which does not match Main Personality "${mainPersonalityName}".`
      )
    }
  })

  deckCards.forEach((card) => {
    const details = cardDetails[card.cardId]
    if (
      details.alignment !== "None" &&
      mainPersonalityAlignment &&
      details.alignment !== mainPersonalityAlignment
    ) {
      errors.push(
        `Card "${card.name}" has alignment "${details.alignment}" which does not match Main Personality alignment "${mainPersonalityAlignment}".`
      )
    }
  })

  return { valid: errors.length === 0, errors }
}
