#!/usr/bin/env python3
"""Build the Requerimiento de Equipo catalog from the authorized workbook.

The workbook is the only data source. The generated catalog keeps a complete
cell trace so verification can prove that no populated service cell was lost.
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any

import openpyxl
from openpyxl.cell.cell import MergedCell


DEFAULT_SPREADSHEET_ID = "1aFozg79pW7PkefUJMJXx1Leu14VZFwcqN3aUa3_Dc-Q"
DEFAULT_MODIFIED_TIME = "2026-09-28T15:32:10.278Z"
DEFAULT_VERSION = "20260929-catalogo-drive-01"
SERVICE_SHEETS = [
    "SUNDAY FUNDAY",
    "DJ",
    "NOVALOOPS",
    "SAXOFONIC",
    "AUDIO",
    "ESTUARDO REYNA",
    "CEREMONIA",
    "COCTEL",
    "ESTRUCTURAS EN L",
    "CUADRILATERO",
    "PISTA DE BAILE",
    "PANTALLA LED",
    "TARIMA",
]
STRUCTURAL_LABELS = {
    "cuadro de montaje",
    "equipo a llevar live productions",
}
INVENTORY_ALIASES = {
    "hdmi de 5mts": "cable hdmi 5 mt",
}


def display_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def comparable_text(value: Any) -> str:
    text = unicodedata.normalize("NFD", display_text(value))
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    text = text.lower().replace("\u201c", "").replace("\u201d", "")
    text = text.replace('"', "").replace("'", "")
    text = re.sub(r"\bno\.\s*", "no ", text)
    text = re.sub(r"[.,;:]+$", "", text)
    return re.sub(r"\s+", " ", text).strip()


def inventory_key(value: Any) -> str:
    key = re.sub(r"\s*/?\s*consumible$", "", comparable_text(value)).strip()
    return INVENTORY_ALIASES.get(key, key)


def slug(value: Any) -> str:
    text = unicodedata.normalize("NFD", display_text(value))
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text.lower()).strip("-")
    return text or "servicio"


def json_value(value: Any) -> Any:
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def is_quantity(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def is_black_fill(cell: Any) -> bool:
    fill = cell.fill
    if fill.fill_type != "solid":
        return False
    color = fill.fgColor
    if color.type == "rgb":
        return str(color.rgb).upper() in {"000000", "FF000000"}
    if color.type == "indexed":
        return color.indexed in {0, 8}
    return False


def is_upper_heading(value: Any) -> bool:
    text = display_text(value)
    letters = "".join(char for char in text if char.isalpha())
    return bool(letters) and letters == letters.upper()


def merged_across_pair(ws: Any, row: int, quantity_col: int, equipment_col: int) -> bool:
    for merged in ws.merged_cells.ranges:
        if merged.min_row <= row <= merged.max_row:
            if merged.min_col <= quantity_col and merged.max_col >= equipment_col:
                return True
    return False


def block_last_row(ws: Any, start_col: int, end_col: int) -> int:
    rows = [
        row
        for row in range(1, ws.max_row + 1)
        if any(
            ws.cell(row, col).value is not None
            and display_text(ws.cell(row, col).value)
            for col in range(start_col, end_col + 1)
        )
    ]
    return max(rows, default=1)


def source_cells(ws: Any, start_col: int, end_col: int, last_row: int) -> list[dict[str, Any]]:
    cells: list[dict[str, Any]] = []
    for row in range(1, last_row + 1):
        for col in range(start_col, end_col + 1):
            cell = ws.cell(row, col)
            if isinstance(cell, MergedCell) or cell.value is None or not display_text(cell.value):
                continue
            cells.append({"address": cell.coordinate, "value": json_value(cell.value)})
    return cells


def add_section_item(
    sections: list[dict[str, Any]],
    title: str,
    quantity: Any,
    description: str,
) -> None:
    if not sections or sections[-1]["title"] != title:
        sections.append({"title": title, "items": []})
    sections[-1]["items"].append([json_value(quantity), description])


def parse_service(
    ws: Any,
    quantity_col: int,
    equipment_col: int,
    trace_end_col: int,
    service_name: str,
    service_id: str,
) -> dict[str, Any]:
    last_row = block_last_row(ws, quantity_col, trace_end_col)
    sections: list[dict[str, Any]] = []
    source_notes: list[dict[str, Any]] = []
    unlabeled_quantities: list[dict[str, Any]] = []
    blank_quantity_items: list[dict[str, Any]] = []
    current_parent = ""
    current_child = ""

    for row in range(1, last_row + 1):
        quantity_cell = ws.cell(row, quantity_col)
        equipment_cell = ws.cell(row, equipment_col)
        quantity = quantity_cell.value
        description = display_text(equipment_cell.value)
        quantity_text = display_text(quantity)

        for col in range(equipment_col + 1, trace_end_col + 1):
            note_cell = ws.cell(row, col)
            if note_cell.value is not None and display_text(note_cell.value):
                source_notes.append({
                    "address": note_cell.coordinate,
                    "value": json_value(note_cell.value),
                })

        if row == 1 and display_text(quantity) == display_text(service_name):
            continue

        if is_quantity(quantity) and description:
            title = " / ".join(part for part in (current_parent, current_child) if part) or "EQUIPO"
            add_section_item(sections, title, quantity, description)
            continue

        heading_text = description or (quantity_text if not is_quantity(quantity) else "")
        heading_cell = equipment_cell if description else quantity_cell
        is_heading = bool(heading_text) and (
            is_black_fill(heading_cell)
            or is_black_fill(quantity_cell)
            or is_black_fill(equipment_cell)
        )

        if is_heading:
            key = comparable_text(heading_text)
            if key in STRUCTURAL_LABELS:
                source_notes.append({"address": heading_cell.coordinate, "value": heading_text})
                continue
            if key == "cantidad" and description:
                heading_text = description
            elif comparable_text(quantity_text) == "cantidad" and description:
                heading_text = description

            if merged_across_pair(ws, row, quantity_col, equipment_col) or is_upper_heading(heading_text):
                current_parent = heading_text
                current_child = ""
            else:
                current_child = heading_text
            continue

        if is_quantity(quantity) and not description:
            unlabeled_quantities.append({
                "address": quantity_cell.coordinate,
                "quantity": json_value(quantity),
            })
            continue

        if description and not quantity_text:
            blank_quantity_items.append({
                "address": equipment_cell.coordinate,
                "equipment": description,
            })
            continue

        if quantity_text or description:
            cell = equipment_cell if description else quantity_cell
            source_notes.append({"address": cell.coordinate, "value": description or json_value(quantity)})

    return {
        "name": display_text(service_name),
        "source": f"{ws.title}!{openpyxl.utils.get_column_letter(quantity_col)}:{openpyxl.utils.get_column_letter(trace_end_col)}",
        "sourceCells": source_cells(ws, quantity_col, trace_end_col, last_row),
        "sourceNotes": source_notes,
        "unlabeledQuantities": unlabeled_quantities,
        "blankQuantityItems": blank_quantity_items,
        "mainSections": sections,
        "extras": [],
    }


def service_starts(ws: Any) -> list[int]:
    if ws.title == "CEREMONIA":
        return [1]
    return [
        col
        for col in range(1, ws.max_column + 1)
        if ws.cell(1, col).value is not None and display_text(ws.cell(1, col).value)
    ]


def build_catalog(workbook: Path, spreadsheet_id: str, modified_time: str, version: str) -> dict[str, Any]:
    wb = openpyxl.load_workbook(workbook, data_only=False)
    missing_sheets = [name for name in ["INVENTARIO", *SERVICE_SHEETS] if name not in wb.sheetnames]
    if missing_sheets:
        raise ValueError(f"Faltan libros obligatorios: {', '.join(missing_sheets)}")

    services: dict[str, dict[str, Any]] = {}
    groups: list[dict[str, Any]] = []
    used_ids: Counter[str] = Counter()

    for sheet_name in SERVICE_SHEETS:
        ws = wb[sheet_name]
        service_ids: list[str] = []
        starts = service_starts(ws)
        populated_max_col = max(
            (
                cell.column
                for row in ws.iter_rows()
                for cell in row
                if cell.value is not None and display_text(cell.value)
            ),
            default=2,
        )
        for index, start_col in enumerate(starts):
            trace_end_col = starts[index + 1] - 1 if index + 1 < len(starts) else max(start_col + 1, populated_max_col)
            raw_name = ws.cell(1, start_col).value if sheet_name != "CEREMONIA" else sheet_name
            name = display_text(raw_name)
            base_id = slug(name)
            used_ids[base_id] += 1
            service_id = base_id if used_ids[base_id] == 1 else f"{base_id}-{used_ids[base_id]}"
            services[service_id] = parse_service(
                ws,
                start_col,
                start_col + 1,
                trace_end_col,
                name,
                service_id,
            )
            service_ids.append(service_id)
        groups.append({"label": sheet_name, "serviceIds": service_ids})

    return {
        "version": version,
        "source": {
            "spreadsheetId": spreadsheet_id,
            "workbook": workbook.name,
            "modifiedTime": modified_time,
            "sheets": ["INVENTARIO", *SERVICE_SHEETS],
            "serviceSheets": SERVICE_SHEETS,
        },
        "services": services,
        "groups": groups,
    }


def verify_catalog(catalog: dict[str, Any], workbook: Path) -> dict[str, Any]:
    wb = openpyxl.load_workbook(workbook, data_only=False)
    expected_services = sum(len(service_starts(wb[name])) for name in SERVICE_SHEETS)
    actual_services = len(catalog["services"])
    if actual_services != expected_services:
        raise ValueError(f"Cuadros esperados: {expected_services}; generados: {actual_services}")

    traced_cells: dict[str, set[str]] = {}
    item_counts = {"all": 0, "zero": 0}
    for service in catalog["services"].values():
        sheet = service["source"].split("!", 1)[0]
        traced_cells.setdefault(sheet, set()).update(cell["address"] for cell in service["sourceCells"])
        for section in service["mainSections"]:
            for quantity, _description in section["items"]:
                item_counts["all"] += 1
                if quantity == 0:
                    item_counts["zero"] += 1

    missing_cells: list[str] = []
    expected_item_count = 0
    expected_zero_count = 0
    for sheet_name in SERVICE_SHEETS:
        ws = wb[sheet_name]
        expected_addresses: set[str] = set()
        starts = service_starts(ws)
        populated_max_col = max(
            (
                cell.column
                for row in ws.iter_rows()
                for cell in row
                if cell.value is not None and display_text(cell.value)
            ),
            default=2,
        )
        for index, start_col in enumerate(starts):
            trace_end_col = starts[index + 1] - 1 if index + 1 < len(starts) else max(start_col + 1, populated_max_col)
            last_row = block_last_row(ws, start_col, trace_end_col)
            expected_addresses.update(
                cell["address"] for cell in source_cells(ws, start_col, trace_end_col, last_row)
            )
            for row in range(1, last_row + 1):
                quantity = ws.cell(row, start_col).value
                description = display_text(ws.cell(row, start_col + 1).value)
                if is_quantity(quantity) and description:
                    expected_item_count += 1
                    if quantity == 0:
                        expected_zero_count += 1
        for address in sorted(expected_addresses - traced_cells.get(sheet_name, set())):
            missing_cells.append(f"{sheet_name}!{address}")
    if missing_cells:
        raise ValueError(f"Celdas sin trazar ({len(missing_cells)}): {', '.join(missing_cells[:20])}")
    if item_counts["all"] != expected_item_count:
        raise ValueError(
            f"Filas de equipo esperadas: {expected_item_count}; generadas: {item_counts['all']}"
        )
    if item_counts["zero"] != expected_zero_count:
        raise ValueError(
            f"Filas con cantidad 0 esperadas: {expected_zero_count}; generadas: {item_counts['zero']}"
        )

    inventory_names: dict[str, list[str]] = {}
    inventory_ws = wb["INVENTARIO"]
    for row in range(1, inventory_ws.max_row + 1):
        name = display_text(inventory_ws.cell(row, 3).value)
        if not name:
            continue
        inventory_names.setdefault(inventory_key(name), []).append(f"INVENTARIO!C{row}")

    unmatched: list[dict[str, str]] = []
    for sheet_name in SERVICE_SHEETS:
        ws = wb[sheet_name]
        starts = service_starts(ws)
        populated_max_col = max(
            (
                cell.column
                for row in ws.iter_rows()
                for cell in row
                if cell.value is not None and display_text(cell.value)
            ),
            default=2,
        )
        for index, start_col in enumerate(starts):
            trace_end_col = starts[index + 1] - 1 if index + 1 < len(starts) else max(start_col + 1, populated_max_col)
            last_row = block_last_row(ws, start_col, trace_end_col)
            service_name = display_text(ws.cell(1, start_col).value) if sheet_name != "CEREMONIA" else sheet_name
            for row in range(1, last_row + 1):
                quantity = ws.cell(row, start_col).value
                description = display_text(ws.cell(row, start_col + 1).value)
                if not (is_quantity(quantity) and description):
                    continue
                if inventory_key(description) not in inventory_names:
                    unmatched.append({
                        "sheet": sheet_name,
                        "cell": ws.cell(row, start_col + 1).coordinate,
                        "service": service_name,
                        "equipment": description,
                    })
    return {
        "services": actual_services,
        "sourceCells": sum(len(service["sourceCells"]) for service in catalog["services"].values()),
        "items": item_counts["all"],
        "zeroQuantityItems": item_counts["zero"],
        "matchedInventoryItems": item_counts["all"] - len(unmatched),
        "unmatchedInventoryDescriptionCount": len({item["equipment"] for item in unmatched}),
        "unmatchedInventoryNames": unmatched,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--spreadsheet-id", default=DEFAULT_SPREADSHEET_ID)
    parser.add_argument("--modified-time", default=DEFAULT_MODIFIED_TIME)
    parser.add_argument("--version", default=DEFAULT_VERSION)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    catalog = build_catalog(
        args.workbook,
        args.spreadsheet_id,
        args.modified_time,
        args.version,
    )
    report = verify_catalog(catalog, args.workbook)

    if args.output:
        args.output.write_text(
            "window.requerimientoEquipoCatalog = "
            + json.dumps(catalog, ensure_ascii=False, indent=2)
            + ";\n",
            encoding="utf-8",
        )
    if args.report:
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({key: value for key, value in report.items() if key != "unmatchedInventoryNames"}, ensure_ascii=False))
    print(
        "Celdas de equipo sin coincidencia exacta en INVENTARIO: "
        f"{len(report['unmatchedInventoryNames'])} "
        f"({report['unmatchedInventoryDescriptionCount']} descripciones únicas)"
    )


if __name__ == "__main__":
    main()
