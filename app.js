function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function getScore(h, d) { return h.rating * 10 - (d * 2); }

// Symptom -> Specialty mapping
const SYMPTOM_MAP = {
  "pregnant": "Maternity", "pregnancy": "Maternity", "labour": "Maternity", "delivery": "Maternity",
  "fever": "General", "headache": "General", "cough": "General", "malaria": "General",
  "child": "Pediatrics", "baby": "Pediatrics", "kid": "Pediatrics",
  "accident": "Emergency", "bleeding": "Emergency", "emergency": "Emergency", "injury": "Emergency",
  "cancer": "Oncology", "heart": "Cardiology", "chest pain": "Cardiology",
  "operation": "Surgery", "surgery": "Surgery", "appendix": "Surgery"
};

let allHospitals = [];
let userLocation = null;
const DEFAULT_LOCATION = { lat: -4.2935, lng: 39.5632 };

async function loadHospitals() {
  const res = await fetch('hospitals.json');
  allHospitals = await res.json();
  renderHospitals();
}

function renderHospitals() {
  const searchText = document.getElementById('searchInput').value.toLowerCase().trim();
  const county = document.getElementById('countyFilter').value;
  let specialty = document.getElementById('specialtyFilter').value;
  const nhifOnly = document.getElementById('nhifFilter').checked;
  const open24Only = document.getElementById('open24Filter').checked;
  const container = document.getElementById('results');

  // Auto-detect specialty from symptom search
  if (searchText) {
    for (let key in SYMPTOM_MAP) {
      if (searchText.includes(key)) { specialty = SYMPTOM_MAP[key]; break; }
    }
  }

  let filtered = allHospitals.filter(h => {
    if (county !== 'All' && h.county !== county) return false;
    if (specialty !== 'All' && !h.specialties.includes(specialty)) return false;
    if (nhifOnly && !h.acceptsNHIF) return false;
    if (open24Only && !h.is24hr) return false;
    if (searchText) {
      const inSymptomMap = Object.keys(SYMPTOM_MAP).some(k => searchText.includes(k));
      // If it's a symptom, we already filtered by specialty, don't filter by text
      if (!inSymptomMap) {
        const hay = (h.name + " " + h.town + " " + h.county).toLowerCase();
        if (!hay.includes(searchText)) return false;
      }
    }
    return true;
  });

  const loc = userLocation || DEFAULT_LOCATION;
  filtered = filtered.map(h => {
    const distance = getDistanceKm(loc.lat, loc.lng, h.lat, h.lng);
    return { ...h, distance, score: getScore(h, distance) };
  });

  // If user searched a specific county/town, sort by distance from that place's center.
  // If user used GPS, sort by score. For simplicity, sort by score always.
  filtered.sort((a, b) => b.score - a.score);

  if (filtered.length === 0) {
    container.innerHTML = "<p>No hospital found. Try another town or clear filters.</p>";
    return;
  }
container.innerHTML = `<p><b>${filtered.length} hospitals found</b></p>` + filtered.map((h, i) => `
    <div class="card ${i===0?'best':''}">
      <h3>${i===0?'⭐ RECOMMENDED • ':''}${h.name}</h3>
      <p>📍 ${h.town}, ${h.county} County • ${h.distance.toFixed(1)} km from you • ⭐ ${h.rating}/5</p>
      <p>${h.specialties.map(s=>`<span class="badge">${s}</span>`).join('')}</p>
      <p>${h.is24hr?'🟢 Open 24hrs':'🔴 Not 24hrs'} &nbsp;•&nbsp; ${h.acceptsNHIF?'✅ NHIF Accepted':'❌ No NHIF'}</p>
      <div class="actions">
        <a class="btn-call" href="tel:${h.phone}">📞 Call ${h.phone}</a>
        <a class="btn-dir" href="https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}" target="_blank">🧭 Get Directions</a>
      </div>
    </div>
  `).join('');
  
}

document.getElementById('locateBtn').addEventListener('click', () => {
  const status = document.getElementById('status');
  status.textContent = "Getting your location...";
  if (!navigator.geolocation) { userLocation = DEFAULT_LOCATION; renderHospitals(); return; }
  navigator.geolocation.getCurrentPosition(
    pos => { userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude }; status.textContent = `Your location: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)} - Showing nearest nationwide`; renderHospitals(); },
    () => { status.textContent = "Location denied. Using Ukunda as default."; userLocation = DEFAULT_LOCATION; renderHospitals(); }
  );
});

['searchInput','countyFilter','specialtyFilter','nhifFilter','open24Filter'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderHospitals);
  document.getElementById(id).addEventListener('change', renderHospitals);
});
function quickSearch(text) {
  document.getElementById('searchInput').value = text;
  renderHospitals();
}
loadHospitals();
