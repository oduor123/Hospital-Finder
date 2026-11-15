// 1. Haversine Formula - Calculates real distance in KM
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in KM
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// 2. Recommendation Score - Distance matters most, then rating
function getScore(hospital, distanceKm) {
  // Lower distance = better. Higher rating = better.
  // We penalize distance heavily: 10 points per KM
  return hospital.rating * 10 - (distanceKm * 2);
}

let allHospitals = [];
let userLocation = null; // {lat, lng}

// Default location: Ukunda town center, if user denies GPS
const DEFAULT_LOCATION = { lat: -4.2935, lng: 39.5632, name: "Ukunda (Default)" };

async function loadHospitals() {
  const res = await fetch('hospitals.json');
  allHospitals = await res.json();
  renderHospitals();
}

function renderHospitals() {
  const specialty = document.getElementById('specialtyFilter').value;
  const nhifOnly = document.getElementById('nhifFilter').checked;
  const open24Only = document.getElementById('open24Filter').checked;
  const container = document.getElementById('results');

  let filtered = allHospitals.filter(h => {
    if (specialty !== 'All' && !h.specialties.includes(specialty)) return false;
    if (nhifOnly && !h.acceptsNHIF) return false;
    if (open24Only && !h.is24hr) return false;
    return true;
  });

  // Add distance + score to each hospital
  const loc = userLocation || DEFAULT_LOCATION;
  filtered = filtered.map(h => {
    const distance = getDistanceKm(loc.lat, loc.lng, h.lat, h.lng);
    return { ...h, distance, score: getScore(h, distance) };
  });

  // Sort: Best score first = Recommended
  filtered.sort((a, b) => b.score - a.score);

  if (filtered.length === 0) {
    container.innerHTML = "<p>No hospital matches your filter.</p>";
    return;
  }

  container.innerHTML = filtered.map((h, index) => `
    <div class="card ${index === 0 ? 'best' : ''}">
      <h3>${index === 0 ? '⭐ RECOMMENDED - ' : ''}${h.name}</h3>
      <p>📍 ${h.town} • ${h.distance.toFixed(1)} km away • ⭐ ${h.rating}/5</p>
      <p>${h.specialties.map(s => `<span class="badge">${s}</span>`).join('')}</p>
      <p>${h.is24hr ? '🟢 Open 24hrs' : '🔴 Not 24hrs'} • ${h.acceptsNHIF ? '✅ NHIF Accepted' : '❌ No NHIF'}</p>
      <p>
        <a href="tel:${h.phone}">📞 Call ${h.phone}</a> &nbsp; | &nbsp;
        <a href="https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}" target="_blank">🧭 Get Directions</a>
      </p>
    </div>
  `).join('');
}

// 3. Geolocation - Get real user location
document.getElementById('locateBtn').addEventListener('click', () => {
  const status = document.getElementById('status');
  status.textContent = "Getting your location...";

  if (!navigator.geolocation) {
    status.textContent = "Geolocation not supported. Using Ukunda as default.";
    userLocation = DEFAULT_LOCATION;
    renderHospitals();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      status.textContent = `Your location: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)} - Showing nearest hospitals`;
      renderHospitals();
    },
    (err) => {
      status.textContent = "Location denied. Using Ukunda town as default location.";
      userLocation = DEFAULT_LOCATION;
      renderHospitals();
    }
  );
});

// Filters re-render instantly
['specialtyFilter', 'nhifFilter', 'open24Filter'].forEach(id => {
  document.getElementById(id).addEventListener('change', renderHospitals);
});

loadHospitals();