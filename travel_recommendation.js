/* ==========================================================================
   Wayfare — Travel Recommendation Web Application
   Tasks 6-10: fetch the JSON "API", match the user's keyword, render results,
   clear them again, and show the current local time at each destination.
   ========================================================================== */

const API_URL = "travel_recommendation_api.json";

/* Cached copy of the JSON so we only hit the network once per page load. */
let travelData = null;

/* Handles for the interval that keeps the local clocks ticking. */
let clockTimer = null;

/* --------------------------------------------------------------------------
   Task 6 — fetch the data
   -------------------------------------------------------------------------- */

function loadTravelData() {
  if (travelData) {
    return Promise.resolve(travelData);
  }

  return fetch(API_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Could not load ${API_URL} (HTTP ${response.status})`);
      }
      return response.json();
    })
    .then((data) => {
      travelData = data;
      // Task 6 asks us to confirm the fetch works by logging the result.
      console.log("Travel recommendation data loaded:", data);
      return data;
    });
}

/* --------------------------------------------------------------------------
   Task 7 — keyword matching

   The search has to survive "Beach", "BEACH", "beaches" and friends, so every
   comparison happens on a lowercased, trimmed copy of the input.
   -------------------------------------------------------------------------- */

const KEYWORD_GROUPS = [
  { key: "beaches",   terms: ["beach", "beaches", "seaside", "shore", "coast"] },
  { key: "temples",   terms: ["temple", "temples", "shrine", "shrines"] },
  { key: "countries", terms: ["country", "countries", "city", "cities"] },
];

function normalise(value) {
  return String(value || "").trim().toLowerCase();
}

/* Flattens the three countries into a single list of city recommendations. */
function allCities(data) {
  return data.countries.reduce((cities, country) => cities.concat(country.cities), []);
}

/* Returns { title, items } for a query, or null when nothing matches. */
function findRecommendations(data, rawQuery) {
  const query = normalise(rawQuery);

  if (!query) {
    return null;
  }

  /* 1. Category keywords: beach / temple / country and their variations. */
  const group = KEYWORD_GROUPS.find((candidate) =>
    candidate.terms.some((term) => query === term || query.includes(term))
  );

  if (group) {
    if (group.key === "countries") {
      return { title: "Countries", items: allCities(data) };
    }
    return {
      title: group.key === "beaches" ? "Beaches" : "Temples",
      items: data[group.key],
    };
  }

  /* 2. A specific country name, e.g. "japan" -> that country's cities. */
  const country = data.countries.find((entry) => normalise(entry.name).includes(query));
  if (country) {
    return { title: country.name, items: country.cities };
  }

  /* 3. Anything else: match against every destination name we know about. */
  const everything = allCities(data).concat(data.temples, data.beaches);
  const matches = everything.filter((item) => normalise(item.name).includes(query));

  return matches.length ? { title: `Results for "${rawQuery.trim()}"`, items: matches } : null;
}

/* --------------------------------------------------------------------------
   Task 10 — current local time at a destination (optional task)
   -------------------------------------------------------------------------- */

function localTime(timeZone) {
  if (!timeZone) {
    return "";
  }

  const options = {
    timeZone: timeZone,
    hour12: true,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  };

  try {
    return new Date().toLocaleTimeString("en-US", options);
  } catch (error) {
    // An unknown IANA zone would otherwise take the whole render down.
    return "";
  }
}

function startClocks() {
  stopClocks();
  clockTimer = setInterval(() => {
    document.querySelectorAll("[data-timezone]").forEach((node) => {
      node.textContent = `Local time — ${localTime(node.dataset.timezone)}`;
    });
  }, 1000);
}

function stopClocks() {
  if (clockTimer) {
    clearInterval(clockTimer);
    clockTimer = null;
  }
}

/* --------------------------------------------------------------------------
   Task 8 — render the recommendations into a CSS grid
   -------------------------------------------------------------------------- */

function buildCard(item) {
  const card = document.createElement("article");
  card.className = "card";

  const image = document.createElement("img");
  image.src = item.imageUrl;
  image.alt = item.name;
  image.loading = "lazy";

  const body = document.createElement("div");
  body.className = "card__body";

  const heading = document.createElement("h3");
  heading.textContent = item.name;
  body.appendChild(heading);

  if (item.timeZone) {
    const time = document.createElement("time");
    time.dataset.timezone = item.timeZone;
    time.textContent = `Local time — ${localTime(item.timeZone)}`;
    body.appendChild(time);
  }

  const description = document.createElement("p");
  description.textContent = item.description;
  body.appendChild(description);

  card.appendChild(image);
  card.appendChild(body);
  return card;
}

function renderResults(result, query) {
  const panel = document.getElementById("results");
  const heroCopy = document.getElementById("heroCopy");

  panel.innerHTML = "";

  if (!result) {
    const empty = document.createElement("div");
    empty.className = "results__empty";
    empty.innerHTML =
      `<p>No recommendations found for <strong></strong>.</p>` +
      `<p>Try <em>beach</em>, <em>temple</em>, <em>country</em>, or a place name such as <em>Kyoto</em>.</p>`;
    empty.querySelector("strong").textContent = query;
    panel.appendChild(empty);
  } else {
    const head = document.createElement("div");
    head.className = "results__head";

    const title = document.createElement("h2");
    title.textContent = "Search Results";

    const count = document.createElement("span");
    count.className = "results__count";
    count.textContent = `${result.items.length} ${
      result.items.length === 1 ? "destination" : "destinations"
    } in ${result.title}`;

    head.appendChild(title);
    head.appendChild(count);

    const grid = document.createElement("div");
    grid.className = "results__grid";
    result.items.forEach((item) => grid.appendChild(buildCard(item)));

    panel.appendChild(head);
    panel.appendChild(grid);
  }

  heroCopy.hidden = true;
  panel.hidden = false;
  startClocks();
}

/* --------------------------------------------------------------------------
   Task 9 — clear the results and put the home page back
   -------------------------------------------------------------------------- */

function clearResults() {
  const panel = document.getElementById("results");
  const heroCopy = document.getElementById("heroCopy");
  const input = document.getElementById("searchInput");

  stopClocks();
  panel.innerHTML = "";
  panel.hidden = true;
  heroCopy.hidden = false;
  input.value = "";
  input.focus();
}

/* --------------------------------------------------------------------------
   Wiring — results appear only after the Search button is pressed (Task 7)
   -------------------------------------------------------------------------- */

function handleSearch() {
  const input = document.getElementById("searchInput");
  const query = input.value;

  if (!normalise(query)) {
    input.focus();
    return;
  }

  loadTravelData()
    .then((data) => renderResults(findRecommendations(data, query), query.trim()))
    .catch((error) => {
      console.error(error);
      renderResults(null, query.trim());
    });
}

function initHomePage() {
  const searchButton = document.getElementById("searchBtn");
  if (!searchButton) {
    return; // About Us / Contact Us pages have no search bar.
  }

  searchButton.addEventListener("click", handleSearch);
  document.getElementById("clearBtn").addEventListener("click", clearResults);

  document.getElementById("searchInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearch();
    }
  });

  // Warm the cache so the first search renders instantly, and satisfy the
  // Task 6 requirement of logging the fetched data to the console.
  loadTravelData().catch((error) => console.error(error));
}

/* --------------------------------------------------------------------------
   Task 5 — Contact Us form handling (client side only; the site is static)
   -------------------------------------------------------------------------- */

function initContactForm() {
  const form = document.getElementById("contactForm");
  if (!form) {
    return;
  }

  const note = document.getElementById("formNote");

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim();
    const message = form.elements.message.value.trim();

    if (!name || !email || !message) {
      note.className = "form__note form__note--error";
      note.textContent = "Please fill in your name, email and message.";
      return;
    }

    note.className = "form__note form__note--ok";
    note.textContent = `Thanks, ${name}. Your message has been received — we'll reply to ${email} shortly.`;
    form.reset();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initHomePage();
  initContactForm();
});
