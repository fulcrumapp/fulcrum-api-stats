var legend;

$(document).ready(function() {
  checkLogin();
});

/* Mapbox layers */
var streets = L.mapbox.tileLayer("spatialnetworks.map-6l9yntw9");
var satellite = L.mapbox.tileLayer("spatialnetworks.map-xkumo5oi");

/* Mapbox map with geocoder & empty legend controls */
var map = L.mapbox.map("map", null, {
  layers: [streets],
  legendControl: {
    position: "bottomleft"
  },
  attributionControl: false,
  infoControl: true
})
  .addControl(L.mapbox.geocoderControl('spatialnetworks.map-6l9yntw9'))
  .fitBounds([[68.007571, 83.671875], [-31.95216, -137.109375]]);
map.infoControl.addInfo("Developed by <a href='http://spatialnetworks.com/'>Spatial Networks</a>");

/* Empty tile & grid layers to hold Fulcrum points */
var fulcrumTiles = L.tileLayer("", {
  maxZoom: 19,
  zIndex: 11
});

var fulcrumGrid = L.mapbox.gridLayer({
  grids: [],
  maxZoom: 19,
  zIndex: 11
});

/* Single group layer for layer control */
var fulcrumGroup = L.layerGroup([
  fulcrumTiles,
  fulcrumGrid
]);

fulcrumGroup.addTo(map);

/* Grid interactivity to iframe Fulcrum record editor/viewer into modal (based on fulcrum_id) */
fulcrumGrid.on("mouseover", function (e) {
  if (e.data) {
    map.getContainer().style.cursor = "pointer";
  }
});

fulcrumGrid.on("click", function (e) {
  if (e.data) {
    $("#fulcrum-info").html("<iframe id='fulcrum-record' src='https://web.fulcrumapp.com/records/"+e.data.id+"' width='100%' height='"+($(document).height()-150)+"px' frameborder=0></iframe>");
    $("#fulcrumModal").modal("show");
  }
});

fulcrumGrid.on("mouseout", function (e) {
  if (e) {
    map.getContainer().style.cursor = "";
  }
});

var baseLayers = {
  "Street Map": streets,
  "Aerial Imagery": satellite
};

var overlayLayers = {
  "Fulcrum Points": fulcrumGroup
};

/* Expanded layer control */
var layerControl = L.control.layers(baseLayers, overlayLayers, {
  collapsed: false
}).addTo(map);

/* Select an account */
$("#context-select").change(function() {
  fetchForms();
  $("#account").html($("option:selected", this).text());
  $("#app").html("<em class='text-danger'>Select an app</em>");
  $("#form-select").css("color", "#a94442");
  $("[name='appended']").remove();
  fulcrumTiles.setUrl("");
  fulcrumGrid._setTileJSON({grids: []});
  map.legendControl.removeLegend(legend);
  map.fitBounds([[68.007571, 83.671875], [-31.95216, -137.109375]]);
  $("#download-link").hide();
});

/* Select an app */
$("#form-select").change(function() {
  if (this.value.length > 0) {
    fetchRecords();
    $(this).css("color", "");
  } else {
    $(this).css("color", "#a94442");
  }
});

function checkLogin() {
  /* Fulcrum API token stored in sessionStorage. If not set, force BASIC authentication and grab the first API token. Switch to localStorage if security is less of a concern.*/
  if (!sessionStorage.getItem("fulcrum_token")) {
    $("#loginModal").modal("show");
  } else {
    $("#form-select").css("color", "#a94442");
    $("#app").html("<em class='text-danger'>Select an app</em>");
    $("#logout-btn").removeClass("hide");
    $("#loginModal").modal("hide");
    fetchAccounts();
  }
}

function login() {
  var username = $("#email").val();
  var password = $("#password").val();
  $.ajax({
    type: "GET",
    url: "https://api.fulcrumapp.com/api/v2/users.json",
    contentType: "application/json",
    dataType: "json",
    headers: {
      "Authorization": btoa(username + ":" + password)
    },
    statusCode: {
      401: function() {
        alert("Incorrect credentials, please try again.");
      }
    },
    success: function (data) {
      sessionStorage.setItem("fulcrum_token", btoa(data.user.contexts[0].api_token));
      checkLogin();
    }
  });
}

function logout() {
  sessionStorage.removeItem("fulcrum_token");
  location.reload();
}

function updateMap(bbox) {
  /* Remove existing legend text, set URL's and fit to bounds fetched from form */
  var key = $("#context-select").val();
  var form = $("#form-select").val();
  map.legendControl.removeLegend(legend);
  fulcrumTiles.setUrl("https://tiles.fulcrumapp.com/tile/"+key+"/"+form+"/{z}/{x}/{y}.png");
  fulcrumGrid._setTileJSON({grids: ["https://tiles.fulcrumapp.com/tile/"+key+"/"+form+"/{z}/{x}/{y}.json"]});
  map.fitBounds([
    [bbox[0], bbox[1]],
    [bbox[2], bbox[3]]
  ], {padding: [2, 2]});
}

function fetchAccounts() {
  $("#loading").show();
  $.ajax({
    url: "https://api.fulcrumapp.com/api/v2/users.json",
    type: "GET",
    contentType: "application/json",
    dataType: "json",
    headers: {
      "X-ApiToken": atob(sessionStorage.getItem("fulcrum_token"))
    },
    success: function(data) {
      var options = "";
      contexts = $(data.user.contexts).sort(function(a,b) {
        return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1;
      });
      $.each(contexts, function(index, context) {
        options += "<option value='" + context.api_token + "'>" + context.name + "</option>";
      });
      $("#context-select").html(options);
    },
    complete: function() {
      $("#account").html($("#context-select option:selected").text());
      $("#loading").hide();
      fetchForms();
    }
  });
}

function fetchForms() {
  $("#loading").show();
  $.ajax({
    url: "https://api.fulcrumapp.com/api/v2/forms.json",
    type: "GET",
    contentType: "application/json",
    dataType: "json",
    headers: {
      "X-ApiToken": $("#context-select").val()
    },
    success: function(data) {
      var options = "<option value=''>Select an App</option>";
      forms = $(data.forms).sort(function(a,b) {
        return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1;
      });
      $.each(forms, function(index, form) {
        options += "<option value='" + form.id + "'>" + form.name + "</option>";
      });
      $("#form-select").html(options);
    },
    complete: function() {
      $("#loading").hide();
    }
  });
}

function fetchRecords() {
  $("#loading").show();
  /* Remove any appended rows from tables */
  $("[name='appended']").remove();
  var created_by = {}, updated_by = {}, statuses = {};
  $.ajax({
    url: "https://api.fulcrumapp.com/api/v2/records.json",
    type: "GET",
    contentType: "application/json",
    data: {
      "form_id": $("#form-select").val()
    },
    headers: {
      "X-ApiToken": $("#context-select").val()
    },
    success: function(data) {
      /* Write total records to stats table and enable download link */
      $("#stats-table").append("<tr name='appended'><th>Total Records:</th><td class='text-right'>" + data.total_count + "</td></tr>");
      $("#download-link").attr("href", "http://api.fulcrumapp.com/api/v2/records?format=csv&form_id="+$("#form-select").val()+"&token="+$("#context-select").val());
      $("#download-link").attr("download", $("#form-select option:selected").text()+".csv");
      $("#download-link").show();
      /* Loop through records to get individual user and status counts */
      $.each(data.records, function(index, record) {
        statuses[record.status] = 1 + (statuses[record.status] || 0);
        created_by[record.created_by] = 1 + (created_by[record.created_by] || 0);
        updated_by[record.updated_by] = 1 + (updated_by[record.updated_by] || 0);
      });
    },
    complete: function() {
      /* Write stats to tables */
      $("#app").html($("#form-select option:selected").text());
      $.each(Object.keys(created_by), function(index, value) {
        $("#user-created-table").append("<tr name='appended'><th>" + value + ":</th><td class='text-right'>" + created_by[value]+ "</td></tr>");
      });
      $.each(Object.keys(updated_by), function(index, value) {
        $("#user-updated-table").append("<tr name='appended'><th>" + value + ":</th><td class='text-right'>" + updated_by[value]+ "</td></tr>");
      });
      $.each(Object.keys(statuses), function(index, value) {
        $("#status-table").append("<tr name='appended'><th>" + value + ":</th><td class='text-right'>" + statuses[value]+ "</td></tr>");
      });
      fetchTotalRepeatables();
      fetchSpecificRepeatables();
      $("#loading").hide();
    }
  });
}

function fetchTotalRepeatables() {
  $("#loading").show();
  $.ajax({
    url: "https://api.fulcrumapp.com/api/v2/child_records.json",
    type: "GET",
    contentType: "application/json",
    data: {
      "newest_first": 1,
      "per_page": 20000,
      "page": 1,
      "form_id": $("#form-select").val()
    },
    headers: {
      "X-ApiToken": $("#context-select").val()
    },
    success: function(data) {
      $("#repeatable-table").append("<tr name='appended'><th>Total Repeatable Records:</th><td class='text-right'>" + data.total_count + "</td></tr>");
    },
    complete: function() {
      $("#loading").hide();
    }
  });
}

function fetchSpecificRepeatables() {
  $("#loading").show();
  $.ajax({
    url: "https://api.fulcrumapp.com/api/v2/forms/"+$("#form-select").val()+".json",
    type: "GET",
    contentType: "application/json",
    dataType: "json",
    headers: {
      "X-ApiToken": $("#context-select").val()
    },
    success: function(data) {
      /* Loop through form elements to get repeatables */
      $.each(data.form.elements, function(index, element) {
        getRepeatables(element);
      });
      /* Now's a good time to grab the bbox from form and update the map */
      updateMap(data.form.bounding_box);
      /* If the form utilizes the status field, build the map legend */
      if (data.form.status_field.choices) {
        legend = "<ul style='margin: 0;'></ul>";
        $.each(data.form.status_field.choices, function(index, choice) {
          legend += "<li style='white-space: nowrap; color: "+choice.color+";'>"+choice.label+"</li>";
        });
        map.legendControl.addLegend(legend);
      }
    },
    complete: function() {
      $("#loading").hide();
    }
  });
}

function getRepeatables(object) {
  for (var property in object) {
    if (object.hasOwnProperty(property)) {
      if (typeof object[property] == "object"){
        getRepeatables(object[property]);
      } else {
        /* If element is a repeatable field, fetch child records */
        if (object[property] === "Repeatable") {
          $("#loading").show();
          $.ajax({
            url: "https://api.fulcrumapp.com/api/v2/child_records.json",
            type: "GET",
            contentType: "application/json",
            data: {
              "newest_first": 1,
              "per_page": 20000,
              "page": 1,
              "form_id": $("#form-select").val(),
              "field_key": object.key
            },
            headers: {
              "X-ApiToken": $("#context-select").val()
            },
            success: function(data) {
              $("#repeatable-table").append("<tr name='appended'><th>" + object.label + "</th><td class='text-right'>" + data.total_count + "</td></tr>");
            },
            complete: function() {
              $("#loading").hide();
            }
          });
        }
      }
    }
  }
}
