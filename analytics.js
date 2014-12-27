var domainExp = /(\/\/www\.|\/\/)(((?!\/).)*)\//
var colors = [
	"#468966",
	"#FFF0A5",
	"#8E2800",
	"#FFB03B",
	"#B64926",
	"#26B693",
	"#FF7A4F",
	"#69220B",
	"#2A764E",
	"#835058",
	"#2CA5A9",
	"#F6D933"
];
var currentColorIndex = 0;
var presetColors = new Object();

function quicksort(arr) {
	if (arr.length <= 1) {
		return arr;
	} else {
		var pivot = arr[0];
		var less = [];
		var more = [];

		for (var i=1; i<arr.length; i++) {
			if (arr[i].visits < pivot.visits) {
				less.push(arr[i]);
			} else {
				more.push(arr[i]);
			}
		}

		less = quicksort(less);
		more = quicksort(more);

		return more.concat([pivot]).concat(less);
	}
}

function generateSegments(data, totalVisits) {
	var minVisits = totalVisits * 0.005;
	var soFar = 0;
	var chartData = [];

	for (var i=0; i<data.length; i++) {
		site = data[i];

		if (site.visits > minVisits) {
			var color = presetColors[site.site];
			if (color == undefined) {
				color = colors[currentColorIndex];

				currentColorIndex += 1;
				if (currentColorIndex == colors.length) {
					currentColorIndex = 0;
				}
				presetColors[site.site] = color;
			}

			chartData.push({
				y: site.visits,
				indexLabel: site.site,
				color: color
			});
			soFar += site.visits;
			lastSegment = site.visits;
		} else {
			break;
		}
	}

	if (soFar < totalVisits) {
		chartData.push({
			y: totalVisits - soFar,
			indexLabel: "other",
			color: "#eee"
		});
	}

	return chartData;
}

function fetchVisits(startTime, endTime, callback) {
	chrome.history.search({
		text: '',
		maxResults: 100000,
		startTime: startTime,
		endTime: endTime
	}, function(rawData) {
		var collapsedVisits = new Object();
		var uniqueUrls = 0;
		var urlsSearched = 0;
		var totalVisits = 0;

		function done() {
			urlsSearched ++;
			if (urlsSearched == uniqueUrls) {
				console.log(collapsedVisits);
				callback(collapsedVisits, totalVisits);
			}
		}

		rawData.forEach(function(historyObj) {
			var domain = historyObj.url.match(domainExp)[2];
			var urlVisits = 0;

			uniqueUrls ++;
			console.log(historyObj.url);

			chrome.history.getVisits({ url: historyObj.url }, function(visitItems) {
				visitItems.forEach(function(visitObj) {
					if (visitObj.visitTime && visitObj.visitTime >= startTime && visitObj.visitTime <= endTime) {
						urlVisits ++;
					}
				});

				if (collapsedVisits[domain] != undefined) {
					collapsedVisits[domain] = collapsedVisits[domain] + urlVisits;
				} else {
					collapsedVisits[domain] = urlVisits;
				}

				totalVisits += urlVisits;
				done();
			});
		});
	});
}

function drawChart(collapsedVisits, totalVisits, name, elementId) {
	var visitArray = quicksort($.map(collapsedVisits, function(value, index) {
		return {
			site: index,
			visits: value
		};
	}));

	var chart = new CanvasJS.Chart(elementId, {
		title: {
			text: name
		},
		animationEnabled: false,
		data: [
			{
				type: "pie",
				indexLabelFontSize: 10,
				indexLabelPlacement: "inside",
				indexLabelBackgroundColor: "rgba(255,255,255,0)",
				indexLabelFontColor: "rgba(0,0,0,0)",
				startAngle: 270,
				toolTipContent: "{indexLabel}: {y} visits",
				showInLegend: false,
				dataPoints: generateSegments(visitArray, totalVisits)
			}
		]
	});

	chart.render();
}

$(function() {
	var d = new Date();

	fetchVisits(
		new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0).getTime(),
		d.getTime(),
		function(visits, total) {
			drawChart(visits, total, "Today", "day");

			fetchVisits(
				d.getTime() - 604800000,
				d.getTime(),
				function(visits, total) {
					drawChart(visits, total, "This week", "week");

					fetchVisits(
						d.getTime() - (4 * 604800000),
						d.getTime(),
						function(visits, total) {
							drawChart(visits, total, "This month", "month");

							fetchVisits(
								d.getTime() - (52 * 604800000),
								d.getTime(),
								function(visits, total) {
									drawChart(visits, total, "This year", "year");
								}
							);
						}
					);
				}
			);
		}
	);
});