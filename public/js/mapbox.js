/* eslint-disable */

export const displayMap = (locations) => {
  mapboxgl.accessToken = 'pk.eyJ1IjoidG5lb3MiLCJhIjoiY2trM3hvNGZwMWZzczJucXNqcG1hZ3lhOSJ9.zgr_lrOv6QDuk6iwwMixYQ';
  var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/tneos/ckk3yfcia04hy17ocagcxo29v',
    scrollZoom: false,
    //center: [-73.719183, 40.631265],
    //zoom: 10,
  });

  const bounds = new mapboxgl.LngLatBounds();

  locations.forEach((loc) => {
    // Create marker
    const el = document.createElement('div');
    el.className = 'marker';
    // Add marker
    new mapboxgl.Marker({
      element: el,
      anchor: 'bottom',
    })
      .setLngLat(loc.coordinates)
      .addTo(map);

    // Add popup
    new mapboxgl.Popup({
      offset: 30,
    })
      .setLngLat(loc.coordinates)
      .setHTML(`<p>Day ${loc.day}: ${loc.description}</p>`)
      .addTo(map);

    // Extend map bounds to include current location
    bounds.extend(loc.coordinates);
  });
  // Moving map and zooming
  map.fitBounds(bounds, {
    padding: {
      top: 200,
      right: 100,
      bottom: 165,
      left: 100,
    },
  });
};
