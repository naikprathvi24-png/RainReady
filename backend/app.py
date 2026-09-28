from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from datetime import date, timedelta


# ============================================================
# RAINREADY - SMART RAINWATER PLANNER
# Backend: Python Flask
#
# Location + Current Weather : Open-Meteo
# Historical Rainfall        : NASA POWER
# ============================================================

app = Flask(
    __name__,
    static_folder="../frontend",
    static_url_path=""
)

CORS(app)


# ============================================================
# CONFIGURATION
# ============================================================

REQUEST_TIMEOUT = 30

RUNOFF_COEFFICIENT = 0.80


# ============================================================
# API URLs
# ============================================================

# Open-Meteo location search
GEOCODING_URL = (
    "https://geocoding-api.open-meteo.com/v1/search"
)


# Open-Meteo current weather
FORECAST_URL = (
    "https://api.open-meteo.com/v1/forecast"
)


# NASA POWER historical daily data
NASA_POWER_URL = (
    "https://power.larc.nasa.gov/api/temporal/daily/point"
)


# ============================================================
# HELPER - VALIDATE COORDINATES
# ============================================================

def validate_coordinates(latitude, longitude):

    try:

        latitude = float(latitude)
        longitude = float(longitude)

    except (TypeError, ValueError):

        return None, None

    if not -90 <= latitude <= 90:

        return None, None

    if not -180 <= longitude <= 180:

        return None, None

    return latitude, longitude


# ============================================================
# HELPER - API REQUEST
# ============================================================

def get_json_from_api(url, params):

    try:

        response = requests.get(
            url,
            params=params,
            timeout=REQUEST_TIMEOUT
        )

        response.raise_for_status()

        return response.json(), None

    except requests.exceptions.Timeout:

        return None, (
            "Weather service took too long to respond."
        )

    except requests.exceptions.RequestException as error:

        print("API error:", error)

        return None, (
            "Unable to connect to the weather service."
        )

    except ValueError:

        return None, (
            "Weather service returned invalid data."
        )


# ============================================================
# HOME
# ============================================================
@app.route("/")
def home():
    return app.send_static_file("index.html")

# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/health")
def health():

    return jsonify({

        "status": "healthy",

        "project": "RainReady"

    })


# ============================================================
# LOCATION SEARCH
# ============================================================

@app.route("/api/location/search")
def location_search():

    location_name = request.args.get(
        "name",
        ""
    ).strip()


    if not location_name:

        return jsonify({

            "success": False,

            "message":
                "Please provide a location name."

        }), 400


    params = {

        "name": location_name,

        "count": 10,

        "language": "en",

        "format": "json"

    }


    data, error = get_json_from_api(

        GEOCODING_URL,

        params

    )


    if error:

        return jsonify({

            "success": False,

            "message": error

        }), 503


    results = []


    for item in data.get("results", []):

        results.append({

            "name":
                item.get("name"),

            "latitude":
                item.get("latitude"),

            "longitude":
                item.get("longitude"),

            "country":
                item.get("country"),

            "country_code":
                item.get("country_code"),

            "admin1":
                item.get("admin1"),

            "timezone":
                item.get("timezone")

        })


    if not results:

        return jsonify({

            "success": False,

            "message":
                "Location was not found.",

            "results": []

        }), 404


    return jsonify({

        "success": True,

        "results": results

    })


# ============================================================
# CURRENT WEATHER
# ============================================================

@app.route("/api/weather")
def current_weather():

    latitude = request.args.get(
        "latitude"
    )

    longitude = request.args.get(
        "longitude"
    )


    latitude, longitude = validate_coordinates(

        latitude,

        longitude

    )


    if latitude is None:

        return jsonify({

            "success": False,

            "message":
                "Invalid latitude or longitude."

        }), 400


    params = {

        "latitude": latitude,

        "longitude": longitude,

        "current": (
            "temperature_2m,"
            "relative_humidity_2m,"
            "apparent_temperature,"
            "precipitation,"
            "rain,"
            "weather_code,"
            "wind_speed_10m"
        ),

        "timezone": "auto"

    }


    data, error = get_json_from_api(

        FORECAST_URL,

        params

    )


    if error:

        return jsonify({

            "success": False,

            "message": error

        }), 503


    return jsonify({

        "success": True,

        "location": {

            "latitude":
                latitude,

            "longitude":
                longitude

        },

        "current":
            data.get(
                "current",
                {}
            ),

        "timezone":
            data.get(
                "timezone"
            ),

        "source":
            "Open-Meteo"

    })


# ============================================================
# NASA POWER - HISTORICAL RAINFALL
# ============================================================

def get_historical_rainfall(
    latitude,
    longitude
):

    # --------------------------------------------------------
    # NASA POWER data can have a small delay.
    # Use data ending 7 days before today to avoid requesting
    # days that may not yet be available.
    # --------------------------------------------------------

    end_date = (
        date.today() -
        timedelta(days=7)
    )


    start_date = (
        end_date -
        timedelta(days=364)
    )


    params = {

        "parameters":
            "PRECTOTCORR",

        "community":
            "AG",

        "longitude":
            longitude,

        "latitude":
            latitude,

        "start":
            start_date.strftime("%Y%m%d"),

        "end":
            end_date.strftime("%Y%m%d"),

        "format":
            "JSON"

    }


    data, error = get_json_from_api(

        NASA_POWER_URL,

        params

    )


    if error:

        return (
            None,
            None,
            None,
            error
        )


    # --------------------------------------------------------
    # NASA POWER response structure:
    #
    # properties
    #     parameter
    #         PRECTOTCORR
    #             YYYYMMDD : rainfall
    # --------------------------------------------------------

    try:

        rainfall_data = (
            data
            .get("properties", {})
            .get("parameter", {})
            .get("PRECTOTCORR", {})
        )

    except AttributeError:

        rainfall_data = {}


    if not rainfall_data:

        return (

            None,

            None,

            None,

            "No rainfall data was returned by NASA POWER."

        )


    total_rainfall = 0.0

    valid_days = 0


    for value in rainfall_data.values():

        try:

            rainfall = float(value)

        except (
            TypeError,
            ValueError
        ):

            continue


        # Ignore NASA missing-data marker
        if rainfall < 0:

            continue


        total_rainfall += rainfall

        valid_days += 1


    if valid_days == 0:

        return (

            None,

            None,

            None,

            "No usable rainfall data was returned."

        )


    return (

        round(
            total_rainfall,
            2
        ),

        start_date,

        end_date,

        valid_days,

        None

    )


# ============================================================
# HISTORICAL RAINFALL ENDPOINT
# ============================================================

@app.route("/api/rainfall")
def rainfall():

    latitude = request.args.get(
        "latitude"
    )

    longitude = request.args.get(
        "longitude"
    )


    latitude, longitude = validate_coordinates(

        latitude,

        longitude

    )


    if latitude is None:

        return jsonify({

            "success": False,

            "message":
                "Invalid latitude or longitude."

        }), 400


    result = get_historical_rainfall(

        latitude,

        longitude

    )


    # --------------------------------------------------------
    # Result contains:
    #
    # total rainfall
    # start date
    # end date
    # valid days
    # error
    # --------------------------------------------------------

    if len(result) == 5:

        (
            total_rainfall,
            start_date,
            end_date,
            valid_days,
            error
        ) = result

    else:

        return jsonify({

            "success": False,

            "message":
                "Unexpected rainfall response."

        }), 500


    if error:

        return jsonify({

            "success": False,

            "message": error

        }), 503


    return jsonify({

        "success": True,

        "rainfall": {

            "total_mm":
                total_rainfall,

            "days_available":
                valid_days

        },

        "period": {

            "start":
                start_date.isoformat(),

            "end":
                end_date.isoformat()

        },

        "location": {

            "latitude":
                latitude,

            "longitude":
                longitude

        },

        "source":
            "NASA POWER PRECTOTCORR"

    })


# ============================================================
# CALCULATE RAINWATER
# ============================================================

@app.route(
    "/api/calculate",
    methods=["POST"]
)
def calculate():

    data = request.get_json(
        silent=True
    )


    if not data:

        return jsonify({

            "success": False,

            "message":
                "No calculation data received."

        }), 400


    # --------------------------------------------------------
    # ROOF AREA
    # --------------------------------------------------------

    try:

        roof_area = float(
            data.get("roof_area")
        )

    except (
        TypeError,
        ValueError
    ):

        return jsonify({

            "success": False,

            "message":
                "Invalid roof area."

        }), 400


    if roof_area <= 0:

        return jsonify({

            "success": False,

            "message":
                "Roof area must be greater than zero."

        }), 400


    # --------------------------------------------------------
    # COORDINATES
    # --------------------------------------------------------

    latitude, longitude = validate_coordinates(

        data.get("latitude"),

        data.get("longitude")

    )


    if latitude is None:

        return jsonify({

            "success": False,

            "message":
                "Invalid latitude or longitude."

        }), 400


    # --------------------------------------------------------
    # GET HISTORICAL RAINFALL
    # --------------------------------------------------------

    result = get_historical_rainfall(

        latitude,

        longitude

    )


    if len(result) != 5:

        return jsonify({

            "success": False,

            "message":
                "Unexpected rainfall response."

        }), 500


    (
        total_rainfall,
        start_date,
        end_date,
        valid_days,
        error
    ) = result


    if error:

        return jsonify({

            "success": False,

            "message": error

        }), 503


    # --------------------------------------------------------
    # RAINWATER FORMULA
    #
    # 1 mm rainfall on 1 m² = 1 litre
    #
    # Water =
    # Roof Area × Rainfall × Runoff Coefficient
    # --------------------------------------------------------

    estimated_water = (

        roof_area *

        total_rainfall *

        RUNOFF_COEFFICIENT

    )


    estimated_water = round(

        estimated_water,

        2

    )


    # --------------------------------------------------------
    # RESULT MESSAGE
    # --------------------------------------------------------

    if estimated_water >= 100000:

        message = (
            "Excellent rainwater collection "
            "potential for your roof."
        )

    elif estimated_water >= 50000:

        message = (
            "Good rainwater collection "
            "potential for your roof."
        )

    elif estimated_water >= 10000:

        message = (
            "Your roof can collect a useful "
            "amount of rainwater."
        )

    else:

        message = (
            "Even a smaller collection system "
            "can help save water."
        )


    # --------------------------------------------------------
    # RESPONSE
    # --------------------------------------------------------

    return jsonify({

        "success": True,

        "calculation": {

            "roof_area_m2":
                round(
                    roof_area,
                    2
                ),

            "rainfall_mm":
                total_rainfall,

            "runoff_coefficient":
                RUNOFF_COEFFICIENT,

            "estimated_water_litres":
                estimated_water

        },

        "period": {

            "start":
                start_date.isoformat(),

            "end":
                end_date.isoformat(),

            "days_available":
                valid_days

        },

        "message":
            message,

        "source":
            "NASA POWER PRECTOTCORR"

    })


# ============================================================
# RECOMMENDATIONS
# ============================================================

@app.route("/api/recommendations")
def recommendations():

    return jsonify({

        "success": True,

        "recommendations": [

            {

                "title":
                    "Gardening",

                "icon":
                    "🌱",

                "description":
                    "Use collected rainwater for "
                    "plants, trees and gardens."

            },

            {

                "title":
                    "Cleaning",

                "icon":
                    "🧹",

                "description":
                    "Use stored rainwater for "
                    "floor and outdoor cleaning."

            },

            {

                "title":
                    "Vehicle Washing",

                "icon":
                    "🚗",

                "description":
                    "Use collected rainwater for "
                    "washing cars and bikes."

            },

            {

                "title":
                    "Toilet Flushing",

                "icon":
                    "🚽",

                "description":
                    "Properly stored and treated "
                    "rainwater can reduce fresh "
                    "water consumption."

            }

        ]

    })


# ============================================================
# ERROR HANDLERS
# ============================================================

@app.errorhandler(404)
def page_not_found(error):

    return jsonify({

        "success": False,

        "message":
            "Endpoint not found."

    }), 404


@app.errorhandler(405)
def method_not_allowed(error):

    return jsonify({

        "success": False,

        "message":
            "HTTP method not allowed."

    }), 405


@app.errorhandler(500)
def internal_server_error(error):

    return jsonify({

        "success": False,

        "message":
            "Internal server error."

    }), 500


# ============================================================
# START SERVER
# ============================================================

if __name__ == "__main__":

    print()

    print("=" * 60)

    print(
        "🌧️  RAINREADY - SMART RAINWATER PLANNER"
    )

    print("=" * 60)

    print(
        "Backend   : Python Flask"
    )

    print(
        "Location  : Open-Meteo"
    )

    print(
        "Weather   : Open-Meteo"
    )

    print(
        "Rainfall  : NASA POWER"
    )

    print(
        "Server    : http://127.0.0.1:5000"
    )

    print("=" * 60)

    print()


    app.run(

        host="127.0.0.1",

        port=5000,

        debug=True

    )