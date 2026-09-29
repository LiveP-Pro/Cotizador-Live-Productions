(() => {
  const catalog = {
    version: "20260928-02",
    datasetId: "",
    source: {
      workbook: "Inventario privado del servidor",
      sheet: "INVENTARIO"
    },
    categories: [],
    sourceCellCount: 0,
    sourceItemCount: 0,
    uniqueEquipmentCount: 0,
    consumableItemCount: 0
  };

  window.requerimientoEquipoInventory = catalog;
  window.LIVE_WAREHOUSE_INITIAL_INVENTORY_META = {
    datasetId: "",
    source: "Inventario privado del servidor",
    title: "INVENTARIO",
    subtitles: []
  };
  window.LIVE_WAREHOUSE_INITIAL_INVENTORY = [];
  window.LIVE_WAREHOUSE_INITIAL_MOVEMENTS = [];
})();
