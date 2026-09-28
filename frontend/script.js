// ===============================
// RAINREADY SCRIPT
// ===============================

const API_BASE_URL = "";


// ============================================================
// LOGIN & ACCOUNT
// ============================================================

function showLogin() {
    document.getElementById("loginFormContainer").style.display = "block";
    document.getElementById("createAccountContainer").style.display = "none";
}


function showCreateAccount() {
    document.getElementById("loginFormContainer").style.display = "none";
    document.getElementById("createAccountContainer").style.display = "block";
}


function createAccount(event) {

    event.preventDefault();

    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;
    const confirmPassword = document.getElementById("registerConfirmPassword").value;

    if (!name || !email || !password || !confirmPassword) {
        alert("Please fill in all the fields.");
        return;
    }

    if (password.length < 6) {
        alert("Password must contain at least 6 characters.");
        return;
    }

    if (password !== confirmPassword) {
        alert("Passwords do not match.");
        return;
    }

    const existingAccount = localStorage.getItem("rainreadyAccount");

    if (existingAccount) {

        const account = JSON.parse(existingAccount);

        if (account.email.toLowerCase() === email.toLowerCase()) {
            alert("An account with this email already exists.");
            return;
        }
    }

    const account = {
        name: name,
        email: email,
        password: password
    };

    localStorage.setItem(
        "rainreadyAccount",
        JSON.stringify(account)
    );

    alert(
        "Account created successfully! 🎉\n\n" +
        "You can now login to RainReady."
    );

    document.getElementById("registerName").value = "";
    document.getElementById("registerEmail").value = "";
    document.getElementById("registerPassword").value = "";
    document.getElementById("registerConfirmPassword").value = "";

    showLogin();

    document.getElementById("loginEmail").value = email;
}


function loginUser(event) {

    event.preventDefault();

    const name = document.getElementById("loginName").value.trim();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!name || !email || !password) {
        alert("Please fill in all the fields.");
        return;
    }

    const savedAccount = localStorage.getItem("rainreadyAccount");

    if (!savedAccount) {

        alert(
            "No RainReady account found.\n\n" +
            "Please create an account first."
        );

        showCreateAccount();
        return;
    }

    const account = JSON.parse(savedAccount);

    if (account.email.toLowerCase() !== email.toLowerCase()) {
        alert("Incorrect email address.");
        return;
    }

    if (account.password !== password) {
        alert("Incorrect password.");
        return;
    }

    if (account.name.toLowerCase() !== name.toLowerCase()) {
        alert("Name does not match the registered account.");
        return;
    }

    document.getElementById("loginPage").style.display = "none";
    document.getElementById("mainWebsite").style.display = "block";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    alert(
        "Welcome back to RainReady, " +
        account.name +
        "! 🌧️💧"
    );
}


// ============================================================
// LOCATION
// ============================================================

let selectedLatitude = null;
let selectedLongitude = null;
let selectedLocationName = "";


// ============================================================
// GET SELECTED LOCATION
// ============================================================

async function searchLocation() {

    const locationSelect = document.getElementById("location");
    const location = locationSelect.value;

    const rainfallInput = document.getElementById("rainfall");
    const weatherStatus = document.getElementById("weatherStatus");

    if (!location) {

        weatherStatus.innerHTML =
            "⚠️ Please select a location first.";

        return;
    }

    weatherStatus.innerHTML =
        "🔎 Finding real location data...";

    try {

        const response = await fetch(
            `${API_BASE_URL}/api/location/search?name=${encodeURIComponent(location)}`
        );

        const data = await response.json();

        if (!response.ok || !data.success || !data.results.length) {

            weatherStatus.innerHTML =
                "❌ Location could not be found.";


            return;
        }

        const result = data.results[0];

        selectedLatitude = result.latitude;
        selectedLongitude = result.longitude;
        selectedLocationName = result.name;

        rainfallInput.value = "";

        weatherStatus.innerHTML =
            "📍 Location: <strong>" +
            escapeHTML(result.name) +
            "</strong><br>" +
            "🌐 Real coordinates found.<br>" +
            "☁️ Loading historical rainfall...";

        await getRainfall();

    } catch (error) {

        console.error(error);

        weatherStatus.innerHTML =
            "❌ Could not connect to the RainReady backend.";

    }
}


// ============================================================
// GET REAL HISTORICAL RAINFALL
// ============================================================

async function getRainfall() {

    const locationSelect = document.getElementById("location");
    const location = locationSelect.value;

    const rainfallInput = document.getElementById("rainfall");
    const weatherStatus = document.getElementById("weatherStatus");

    if (!location) {

        weatherStatus.innerHTML =
            "⚠️ Please select a location first.";

        return;
    }

    try {

        // If coordinates are not available, find them first
        if (selectedLatitude === null || selectedLongitude === null) {

            const locationResponse = await fetch(
                `${API_BASE_URL}/api/location/search?name=${encodeURIComponent(location)}`
            );

            const locationData = await locationResponse.json();

            if (
                !locationResponse.ok ||
                !locationData.success ||
                !locationData.results.length
            ) {

                weatherStatus.innerHTML =
                    "❌ Could not find this location.";

                return;
            }

            const result = locationData.results[0];

            selectedLatitude = result.latitude;
            selectedLongitude = result.longitude;
            selectedLocationName = result.name;
        }


        weatherStatus.innerHTML =
            "🌧️ Getting real historical rainfall from NASA POWER...";


        const response = await fetch(
            `${API_BASE_URL}/api/rainfall?latitude=${selectedLatitude}&longitude=${selectedLongitude}`
        );


        const data = await response.json();


        if (!response.ok || !data.success) {

            weatherStatus.innerHTML =
                "❌ Historical rainfall data could not be loaded.";

            return;
        }


        // EXACT rainfall from backend
        const rainfall = Number(data.rainfall.total_mm);


        rainfallInput.value = rainfall.toFixed(2);


        weatherStatus.innerHTML =
            "📍 Location: <strong>" +
            escapeHTML(selectedLocationName || location) +
            "</strong><br>" +

            "🌧️ Previous 365 Days Rainfall: <strong>" +
            rainfall.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }) +
            " mm</strong><br>" +

            "📡 Source: <strong>" +
            escapeHTML(data.source || "NASA POWER") +
            "</strong><br>" +

            "✅ Real rainfall data successfully loaded.";


        // Automatically calculate if roof area exists
        const roofArea =
            Number(document.getElementById("roofArea").value);

        if (roofArea > 0) {

            calculateWater();

        }

    } catch (error) {

        console.error(error);

        weatherStatus.innerHTML =
            "❌ Could not connect to the rainfall service.";

    }
}


// ============================================================
// CALCULATE RAINWATER
// ============================================================

async function calculateWater() {

    const roofArea =
        Number(document.getElementById("roofArea").value);

    const rainfallInput =
        document.getElementById("rainfall");

    const waterResult =
        document.getElementById("waterResult");

    const resultMessage =
        document.getElementById("resultMessage");


    // --------------------------------------------------------
    // VALIDATE ROOF AREA
    // --------------------------------------------------------

    if (!Number.isFinite(roofArea) || roofArea <= 0) {

        waterResult.textContent =
            "Enter Roof Area";

        resultMessage.textContent =
            "Please enter your roof area in square metres.";

        return;
    }


    // --------------------------------------------------------
    // VALIDATE LOCATION
    // --------------------------------------------------------

    if (
        selectedLatitude === null ||
        selectedLongitude === null
    ) {

        waterResult.textContent =
            "Select Location";

        resultMessage.textContent =
            "Please select a location and get real rainfall data first.";

        return;
    }


    // --------------------------------------------------------
    // SHOW CALCULATING
    // --------------------------------------------------------

    waterResult.textContent =
        "Calculating...";

    resultMessage.textContent =
        "Getting real rainfall data from the RainReady backend...";


    try {

        // ----------------------------------------------------
        // CALL BACKEND
        // ----------------------------------------------------

        const response = await fetch(
            `${API_BASE_URL}/api/calculate`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    roof_area: roofArea,

                    latitude: selectedLatitude,

                    longitude: selectedLongitude

                })
            }
        );


        const data =
            await response.json();


        console.log(
            "RainReady calculation response:",
            data
        );


        // ----------------------------------------------------
        // CHECK BACKEND RESPONSE
        // ----------------------------------------------------

        if (
            !response.ok ||
            !data.success ||
            !data.calculation
        ) {

            waterResult.textContent =
                "Calculation Error";

            resultMessage.textContent =
                data.message ||
                "Unable to calculate rainwater collection.";

            return;
        }


        // ----------------------------------------------------
        // GET VALUES FROM BACKEND
        //
        // IMPORTANT:
        // Your Flask backend puts these inside:
        // data.calculation
        // ----------------------------------------------------

        const rainfall =
            Number(
                data.calculation.rainfall_mm
            );


        const estimatedWater =
            Number(
                data.calculation.estimated_water_litres
            );


        // ----------------------------------------------------
        // VALIDATE RAINFALL
        // ----------------------------------------------------

        if (
            !Number.isFinite(rainfall) ||
            rainfall <= 0
        ) {

            waterResult.textContent =
                "Rainfall Error";

            resultMessage.textContent =
                "The backend did not return valid rainfall data.";

            return;
        }


        // ----------------------------------------------------
        // VALIDATE WATER CALCULATION
        // ----------------------------------------------------

        if (
            !Number.isFinite(estimatedWater) ||
            estimatedWater < 0
        ) {

            waterResult.textContent =
                "Calculation Error";

            resultMessage.textContent =
                "The backend did not return a valid water calculation.";

            return;
        }


        // ----------------------------------------------------
        // UPDATE RAINFALL FIELD
        // ----------------------------------------------------

        rainfallInput.value =
            rainfall.toFixed(2);


        // ----------------------------------------------------
        // DISPLAY WATER RESULT
        // ----------------------------------------------------

        waterResult.textContent =
            Math.round(
                estimatedWater
            ).toLocaleString("en-IN") +
            " Litres";


        // ----------------------------------------------------
        // RESULT MESSAGE
        // ----------------------------------------------------

        if (estimatedWater >= 100000) {

            resultMessage.textContent =
                "🌟 Excellent! Your roof has very high rainwater harvesting potential.";

        }

        else if (estimatedWater >= 50000) {

            resultMessage.textContent =
                "💧 Great potential! You can save a significant amount of water.";

        }

        else if (estimatedWater >= 10000) {

            resultMessage.textContent =
                "🌱 Good potential! Use collected rainwater for gardening and cleaning.";

        }

        else {

            resultMessage.textContent =
                "💚 Every drop matters! Even a small collection helps save water.";

        }


        // ----------------------------------------------------
        // SHOW REAL DATA IN CONSOLE
        // ----------------------------------------------------

        console.log(
            "Roof Area:",
            roofArea,
            "m²"
        );

        console.log(
            "Rainfall:",
            rainfall,
            "mm"
        );

        console.log(
            "Estimated Water:",
            estimatedWater,
            "litres"
        );


        // ----------------------------------------------------
        // SCROLL TO RESULT
        // ----------------------------------------------------

        document.getElementById("result").scrollIntoView({

            behavior: "smooth",

            block: "center"

        });


    } catch (error) {

        console.error(
            "RainReady calculation error:",
            error
        );


        waterResult.textContent =
            "Connection Error";


        resultMessage.textContent =
            "Could not connect to the RainReady backend.";

    }
}


// ============================================================
// CURRENT WEATHER
// ============================================================

async function getCurrentWeather() {

    if (
        selectedLatitude === null ||
        selectedLongitude === null
    ) {

        return;
    }

    try {

        const response = await fetch(
            `${API_BASE_URL}/api/weather?latitude=${selectedLatitude}&longitude=${selectedLongitude}`
        );

        const data = await response.json();

        if (!response.ok || !data.success) {

            return;
        }

        const weatherStatus =
            document.getElementById("weatherStatus");

        weatherStatus.innerHTML +=
            "<br>🌡️ Current Temperature: <strong>" +
            data.temperature +
            " °C</strong>";

    } catch (error) {

        console.error(
            "Weather error:",
            error
        );
    }
}


// ============================================================
// LOCATION CHANGE
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const locationSelect =
            document.getElementById("location");

        if (locationSelect) {

            locationSelect.addEventListener(
                "change",
                function () {

                    selectedLatitude = null;
                    selectedLongitude = null;
                    selectedLocationName = "";

                    document.getElementById("rainfall").value = "";

                    document.getElementById("weatherStatus").innerHTML =
                        "📍 Location selected. Click <strong>Get Rainfall Data</strong>.";

                }
            );
        }


        // Backend health check

        fetch(`${API_BASE_URL}/health`)
            .then(response => response.json())
            .then(data => {

                console.log(
                    "RainReady backend:",
                    data
                );

            })
            .catch(error => {

                console.warn(
                    "RainReady backend is not connected.",
                    error
                );

            });

    }
);


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
// ============================================================
// RAINREADY RECOMMENDATION POPUP
// ============================================================

const recommendationData = {

    gardening: {

        icon: "🌱",

        title: "Rainwater for Gardening",

        description:
            "Collected rainwater can be used for watering plants, trees, flowers and kitchen gardens.",

        benefits: [
            "Reduces the use of fresh water",
            "Useful for home gardens and plants",
            "Helps maintain plants during dry periods"
        ],

        tip:
            "Keep stored rainwater covered and clean before using it for plants."
    },


    cleaning: {

        icon: "🧹",

        title: "Rainwater for Cleaning",

        description:
            "Stored rainwater can be used for floor cleaning, outdoor cleaning and other non-drinking purposes.",

        benefits: [
            "Reduces fresh-water consumption",
            "Useful for floor and outdoor cleaning",
            "Makes practical use of harvested rainwater"
        ],

        tip:
            "Keep the rainwater storage container clean and covered."
    },


    vehicle: {

        icon: "🚗",

        title: "Rainwater for Vehicle Washing",

        description:
            "Stored rainwater can help reduce fresh-water consumption when washing cars, bikes and other vehicles.",

        benefits: [
            "Useful for washing cars",
            "Can be used for bikes and bicycles",
            "Reduces the use of fresh water for washing"
        ],

        tip:
            "Filter stored water before using it for vehicle washing."
    },


    toilet: {

        icon: "🚽",

        title: "Rainwater for Toilet Flushing",

        description:
            "Properly collected and appropriately treated rainwater can be used for toilet flushing.",

        benefits: [
            "Reduces fresh-water consumption",
            "Makes better use of harvested rainwater",
            "Suitable for non-drinking purposes"
        ],

        tip:
            "Use a proper rainwater storage and plumbing system separated from the drinking-water supply."
    }

};


// ============================================================
// OPEN POPUP
// ============================================================

function openRecommendation(type) {

    const data = recommendationData[type];

    if (!data) {
        return;
    }


    document.getElementById(
        "recommendationModalIcon"
    ).textContent = data.icon;


    document.getElementById(
        "recommendationModalTitle"
    ).textContent = data.title;


    document.getElementById(
        "recommendationModalDescription"
    ).textContent = data.description;


    const benefitsList =
        document.getElementById(
            "recommendationModalBenefits"
        );


    benefitsList.innerHTML = "";


    data.benefits.forEach(function(benefit) {

        const li =
            document.createElement("li");

        li.textContent =
            "✓ " + benefit;

        benefitsList.appendChild(li);

    });


    document.getElementById(
        "recommendationModalTip"
    ).textContent = data.tip;


    document.getElementById(
        "recommendationModal"
    ).style.display = "flex";

}


// ============================================================
// CLOSE POPUP
// ============================================================

function closeRecommendation() {

    document.getElementById(
        "recommendationModal"
    ).style.display = "none";

}


// ============================================================
// CLOSE WHEN CLICKING OUTSIDE
// ============================================================

document.addEventListener("click", function(event) {

    const modal =
        document.getElementById(
            "recommendationModal"
        );

    if (event.target === modal) {

        closeRecommendation();

    }

});


// ============================================================
// CLOSE WITH ESCAPE
// ============================================================

document.addEventListener("keydown", function(event) {

    if (event.key === "Escape") {

        closeRecommendation();

    }

});