import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import datetime, math, copy

import os, json

CONFIG_FILE = os.path.expanduser("~/.gcode_generator_config.json")

def load_last_path():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                data = json.load(f)
                return data.get("last_save_dir", os.path.expanduser("~"))
        except:
            pass
    return os.path.expanduser("~")

def save_last_path(path):
    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump({"last_save_dir": path}, f)
    except:
        pass


# =====================================
# --- Constants and Defaults ---
# =====================================

WELL_BOTTOM_Z = 2.35
DEFAULT_LOWER_Z_OFFSET = 1.5
DEFAULT_UPPER_Z_OFFSET = 1.51
WELL_DIAM_MM = 14.5  # 24-well internal diameter (for preview circle)
PREVIEW_CENTER_X_OFFSET_MM = 1.0 # subtract from center X so preview circle at 36.55 for column A (G-code unchanged)
PREVIEW_CENTER_Y_OFFSET_MM = 3.0 # add to center Y so preview circle middle at 52.3 (G-code start unchanged)

# --- Default 24-well CENTER coordinates (A-D x 1-6) in mm; used for G-code start position (preview center offset below) ---
DEFAULT_24WELL_CENTERS = {
    'A1': (37.55, 49.3),  'A2': (37.55, 68.6),  'A3': (37.55, 87.9),
    'A4': (37.55, 107.2), 'A5': (37.55, 126.5), 'A6': (37.55, 145.8),
    'B1': (56.85, 49.3),  'B2': (56.85, 68.6),  'B3': (56.85, 87.9),
    'B4': (56.85, 107.2), 'B5': (56.85, 126.5), 'B6': (56.85, 145.8),
    'C1': (76.15, 49.3),  'C2': (76.15, 68.6),  'C3': (76.15, 87.9),
    'C4': (76.15, 107.2), 'C5': (76.15, 126.5), 'C6': (76.15, 145.8),
    'D1': (95.45, 49.3),  'D2': (95.45, 68.6),  'D3': (95.45, 87.9),
    'D4': (95.45, 107.2), 'D5': (95.45, 126.5), 'D6': (95.45, 145.8),
}

# =====================================
# --- Utility Helpers ---
# =====================================

def safe_int(entry):
    try:
        return int(entry.get())
    except:
        return 0

def safe_float(entry):
    try:
        return float(entry.get())
    except:
        return 0.0


def get_well_center_mm(well_key):
    """Return (x, y) in mm for the well center (middle of circle) for the given well."""
    cx, cy = DEFAULT_24WELL_CENTERS.get(well_key, DEFAULT_24WELL_CENTERS["A1"])
    return (cx - PREVIEW_CENTER_X_OFFSET_MM, cy + PREVIEW_CENTER_Y_OFFSET_MM)


def start_position_for_center_dot_at_well_center(well_key, num_dots, dots_per_row, spacing_x, spacing_y):
    """Return (start_x, start_y) so that the center dot of the grid is at the well center.
    Does not change G-code logic; only computes start position from grid geometry."""
    if dots_per_row <= 0:
        return get_well_center_mm(well_key)
    rows = math.ceil(num_dots / dots_per_row)
    center_col = (dots_per_row - 1) // 2
    center_row = (rows - 1) // 2
    wcx, wcy = get_well_center_mm(well_key)
    start_x = wcx - center_col * spacing_x
    start_y = wcy - center_row * spacing_y
    return (start_x, start_y)


# =====================================
# --- Info Dialog ---
# =====================================

def show_about():
    messagebox.showinfo(
        "About G-code Generator",
        "G-code Generator v3.0 — Calibration & Zoom Edition\n"
        "© 2025 Arielle Wolter\n\n"
        "• Real Start X/Y preview movement\n"
        "• Zoom 50–200% live preview\n"
        "• Collapsible 24-well calibration (hard-coded, editable)\n"
        "• Reset Calibration & Reset All defaults\n"
    )


# =====================================
# --- G-code Generation ---
# =====================================

def generate_dot_series_gcode(start_x, start_y, num_dots, dot_spacing_x, dot_spacing_y,
                              lower_z, upper_z, well_number, dots_per_row, output_path, annotate=False):
    current_date = datetime.datetime.now().strftime("%d-%b-%Y %H:%M:%S")
    # Use lower_z and upper_z as absolute Z values directly
    abs_lower = lower_z
    abs_upper = upper_z
    # Fixed approach, retract, and safe heights
    z_approach = 4.71
    z_retract = 4.31  # Fixed retract height
    z_safe = 6.21  # Fixed safe height
    z_final = 23.0
    
    # Determine row number from well letter (A=1, B=2, C=3, D=4)
    well_letter = well_number[0] if well_number and well_number[0].isalpha() else 'A'
    row_num = ord(well_letter.upper()) - ord('A') + 1

    with open(output_path, "w") as f:
        f.write(f"; G-code generated {current_date}\n")
        f.write(f"; Well {well_number} | Lower Z {lower_z:.2f} mm | Upper Z {upper_z:.2f} mm\n\n")
        
        # Write required header components
        f.write(f"BottomElevation: {WELL_BOTTOM_Z:.2f}\n")
        f.write("; Zbottom: \n")
        f.write("; Zplus: \n")
        f.write("; Zplusplus: \n")
        f.write("; Zvoid: \n")
        f.write(f"; num2str(t) ;WORKING ON ROW {row_num} OF THE 24 WELL TRAY\n")
        f.write(f"; Well number {well_number}\n\n")
        
        f.write("M83\n\n")
        f.write("G4 P100\n\n")

        rows = math.ceil(num_dots / dots_per_row)
        dot_index = 0
        for r in range(rows):
            for c in range(dots_per_row):
                if dot_index >= num_dots:
                    break
                x = start_x + c * dot_spacing_x
                y = start_y + r * dot_spacing_y
                f.write(f"\n; Begin dot {dot_index+1}\n")
                
                if annotate:
                    f.write(f"G1 X{x:.2f} Y{y:.2f} F350  ; Move to dot position (X, Y) at 350 mm/min\n")
                    f.write(f"G4 P200                ; Pause 200ms to stabilize\n")
                    f.write(f"G1 Z{z_approach:.2f} F250          ; Move down to approach height at 250 mm/min\n")
                    f.write(f"G4 P200                ; Pause 200ms\n")
                    f.write(f"G1 Z{abs_lower:.2f} F30        ; Slowly descend to lower position ({abs_lower:.2f}mm) at 30 mm/min\n")
                    f.write(f"G4 P500                ; Pause 500ms at lower position\n")
                    f.write(f"G1 Z{abs_upper:.2f} E 0.0105 F3 ; Move up to upper position ({abs_upper:.2f}mm), extrude 0.0105, slow at 3 mm/min\n")
                    f.write(f"G4 S1.5                ; Wait 1.5 seconds for dispensing\n")
                    f.write(f"G1 Z{z_retract:.2f} F80           ; Retract to {z_retract:.2f}mm at 80 mm/min\n")
                    f.write(f"G4 P750                ; Pause 750ms\n")
                    f.write(f"G1 Z{z_safe:.2f} F350             ; Lift to safe height ({z_safe:.2f}mm) at 350 mm/min\n")
                    f.write(f"G4 P200                ; Final pause 200ms\n")
                else:
                    f.write(f"G1 X{x:.2f} Y{y:.2f} F350\n")
                    f.write(f"G4 P200\n")
                    f.write(f"G1 Z{z_approach:.2f} F250\n")
                    f.write(f"G4 P200\n")
                    f.write(f"G1 Z{abs_lower:.2f} F30\n")
                    f.write(f"G4 P500\n")
                    f.write(f"G1 Z{abs_upper:.2f} E 0.0105 F3\n")
                    f.write(f"G4 S1.5\n")
                    f.write(f"G1 Z{z_retract:.2f} F80\n")
                    f.write(f"G4 P750\n")
                    f.write(f"G1 Z{z_safe:.2f} F350\n")
                    f.write(f"G4 P200\n")
                dot_index += 1

        f.write("\n; === End sequence ===\n")
        if annotate:
            f.write("G1 Z23 F250            ; Move to final safe height (23mm) at 250 mm/min\n")
            f.write("G4 P100                ; Final pause 100ms\n")
        else:
            f.write("G1 Z23 F250\n")
            f.write("G4 P100\n")

    messagebox.showinfo("Success", f"G-code saved to:\n{output_path}")


# =====================================
# --- GUI Setup ---
# =====================================

root = tk.Tk()
root.title("G-code Generator – 24 Well Plate")
root.geometry("950x1000")
root.configure(padx=16, pady=16)
root.columnconfigure(0, weight=1)
root.columnconfigure(1, weight=1)

# Force window to front on macOS
root.lift()
root.attributes('-topmost', True)
root.after_idle(root.attributes, '-topmost', False)

# --- Menu bar ---
menubar = tk.Menu(root)
root.config(menu=menubar)
menu = tk.Menu(menubar, tearoff=0)
menu.add_command(label="About", command=show_about)
menu.add_separator()
menu.add_command(label="Quit", command=root.quit)
menubar.add_cascade(label="G-code Generator", menu=menu)

# ============ Left column (Controls) ============
left = tk.Frame(root)
left.grid(row=0, column=0, sticky="nsew", padx=(0,12))
left.columnconfigure(0, weight=1)

row = 0
tk.Label(left, text="Select Well Position:", font=('Helvetica',11,'bold')).grid(row=row, column=0, sticky='w')
row += 1

well_var = tk.StringVar(value="A1")
well_dropdown = ttk.Combobox(left, textvariable=well_var,
                             values=list(DEFAULT_24WELL_CENTERS.keys()),
                             state='readonly', width=40)
well_dropdown.grid(row=row, column=0, sticky='ew', pady=(0,10))
row += 1

entries = {}
for label in [
    "Start X (mm)", "Start Y (mm)",
    "Number of Dots", "Dots Per Row", "Number of Rows",
    "Dot Spacing X (mm)", "Dot Spacing Y (mm)",
    "Lower Z Offset (mm above bottom)", "Upper Z Offset (mm above bottom)", "Well Number"
]:
    tk.Label(left, text=label).grid(row=row, column=0, sticky='w')
    row += 1
    e = tk.Entry(left, width=42)
    e.grid(row=row, column=0, sticky='ew', pady=(0,6))
    row += 1
    entries[label] = e

# --- Start at well center option + Snap button ---
start_at_well_center_var = tk.BooleanVar(value=False)

def snap_to_well_center():
    """Set Start X/Y so the center dot of the current grid is at the well center (middle)."""
    sel = well_var.get()
    num_dots = safe_int(entries["Number of Dots"])
    dots_per_row = safe_int(entries["Dots Per Row"])
    spacing_x = safe_float(entries["Dot Spacing X (mm)"])
    spacing_y = safe_float(entries["Dot Spacing Y (mm)"])
    start_x, start_y = start_position_for_center_dot_at_well_center(
        sel, num_dots, dots_per_row, spacing_x, spacing_y
    )
    entries["Start X (mm)"].delete(0, tk.END)
    entries["Start X (mm)"].insert(0, f"{start_x:.2f}")
    entries["Start Y (mm)"].delete(0, tk.END)
    entries["Start Y (mm)"].insert(0, f"{start_y:.2f}")
    draw_preview()

tk.Checkbutton(left, text="Start at well center (middle)", variable=start_at_well_center_var,
               font=('Helvetica', 10), command=lambda: (set_defaults_from_current_well(), draw_preview())) \
    .grid(row=row, column=0, sticky='w', pady=(2, 4))
row += 1
tk.Button(left, text="Snap to well center", command=snap_to_well_center, font=('Helvetica', 10)) \
    .grid(row=row, column=0, sticky='ew', pady=(0, 8))
row += 1


# --- Default field setup ---

def set_defaults_from_current_well():
    sel = well_var.get()
    entries["Number of Dots"].delete(0, tk.END); entries["Number of Dots"].insert(0, "30")
    entries["Dots Per Row"].delete(0, tk.END); entries["Dots Per Row"].insert(0, "10")
    entries["Number of Rows"].delete(0, tk.END); entries["Number of Rows"].insert(0, "3")
    entries["Dot Spacing X (mm)"].delete(0, tk.END); entries["Dot Spacing X (mm)"].insert(0, "0.3")
    entries["Dot Spacing Y (mm)"].delete(0, tk.END); entries["Dot Spacing Y (mm)"].insert(0, "1.5")
    entries["Lower Z Offset (mm above bottom)"].delete(0, tk.END); entries["Lower Z Offset (mm above bottom)"].insert(0, f"{DEFAULT_LOWER_Z_OFFSET:.2f}")
    entries["Upper Z Offset (mm above bottom)"].delete(0, tk.END); entries["Upper Z Offset (mm above bottom)"].insert(0, f"{DEFAULT_UPPER_Z_OFFSET:.2f}")
    entries["Well Number"].delete(0, tk.END); entries["Well Number"].insert(0, sel)
    if start_at_well_center_var.get():
        start_x, start_y = start_position_for_center_dot_at_well_center(
            sel, 30, 10, 0.3, 1.5
        )
        entries["Start X (mm)"].delete(0, tk.END); entries["Start X (mm)"].insert(0, f"{start_x:.2f}")
        entries["Start Y (mm)"].delete(0, tk.END); entries["Start Y (mm)"].insert(0, f"{start_y:.2f}")
    else:
        cx, cy = DEFAULT_24WELL_CENTERS.get(sel, DEFAULT_24WELL_CENTERS["A1"])
        entries["Start X (mm)"].delete(0, tk.END); entries["Start X (mm)"].insert(0, f"{cx:.2f}")
        entries["Start Y (mm)"].delete(0, tk.END); entries["Start Y (mm)"].insert(0, f"{cy:.2f}")

set_defaults_from_current_well()


# --- Code Annotation Checkbox ---
annotate_var = tk.BooleanVar(value=True)  # Checked by default
tk.Checkbutton(left, text="📝 Include code annotations (explains what each line does)", 
               variable=annotate_var, font=('Helvetica', 10)).grid(row=row, column=0, sticky='w', pady=(8, 4))
row += 1

# --- Reset All ---
def reset_all_fields():
    set_defaults_from_current_well()
    draw_preview()

tk.Button(left, text="Reset All Fields", command=reset_all_fields).grid(row=row, column=0, sticky='ew', pady=(8,12))
row += 1

# --- Save G-code Function + Button ---

def save_gcode():
    try:
        sx = safe_float(entries["Start X (mm)"])
        sy = safe_float(entries["Start Y (mm)"])
        nd = safe_int(entries["Number of Dots"])
        dx = safe_float(entries["Dot Spacing X (mm)"])
        dy = safe_float(entries["Dot Spacing Y (mm)"])
        lz = safe_float(entries["Lower Z Offset (mm above bottom)"])
        uz = safe_float(entries["Upper Z Offset (mm above bottom)"])
        wn = entries["Well Number"].get().strip()
        pr = safe_int(entries["Dots Per Row"])

        if not wn:
            return messagebox.showerror("Error", "Well number required.")
        if nd <= 0 or pr <= 0:
            return messagebox.showerror("Error", "Dots and Dots Per Row must be > 0.")
        if lz < 0 or uz < 0:
            return messagebox.showerror("Error", "Z offsets cannot be negative.")

        # --- NEW: Remember last directory ---
        initial_dir = load_last_path()
        path = filedialog.asksaveasfilename(
            defaultextension=".txt",
            filetypes=[("G-code files", "*.txt")],
            initialdir=initial_dir,
            title="Save G-code as",
            initialfile=f"well_{wn}_Z{lz:.2f}.txt"
        )

        if path:
            save_last_path(os.path.dirname(path))
            generate_dot_series_gcode(sx, sy, nd, dx, dy, lz, uz, wn, pr, path, annotate=annotate_var.get())

    except Exception as e:
        messagebox.showerror("Error", str(e))

# Save button (below Reset All)
tk.Button(left,
          text="💾 Save G-code",
          command=save_gcode,
          bg="#4CAF50",
          fg="white",
          font=('Helvetica', 12, 'bold'),
          pady=8).grid(row=row, column=0, sticky='ew', pady=(0,10))
row += 1


# ============ Right column (Preview + Calibration) ============
right = tk.Frame(root)
right.grid(row=0, column=1, sticky="nsew")
right.columnconfigure(0, weight=1)

# --- Preview Canvas + Zoom ---
preview_frame = tk.LabelFrame(right, text="Well Layout Preview")
preview_frame.grid(row=0, column=0, sticky="nsew", pady=(0,10))
preview_frame.columnconfigure(0, weight=1)

canvas = tk.Canvas(preview_frame, width=500, height=500, bg="white")
canvas.grid(row=0, column=0, sticky='nsew', padx=10, pady=10)

zoom_var = tk.DoubleVar(value=100.0)
def on_zoom(_=None):
    draw_preview()

zoom_frame = tk.Frame(preview_frame)
zoom_frame.grid(row=1, column=0, sticky='ew', padx=10, pady=(0,10))
tk.Label(zoom_frame, text="Zoom (%)").pack(side='left')
tk.Scale(zoom_frame, variable=zoom_var, from_=50, to=200, orient='horizontal',
         showvalue=True, resolution=5, command=on_zoom, length=280).pack(side='left', padx=8)

size_label = tk.Label(preview_frame, text="Well Ø 15.6 mm | Grid – × – mm",
                      font=('Helvetica',10,'italic'), fg="gray")
size_label.grid(row=2, column=0, sticky='w', padx=10)

coord_label = tk.Label(preview_frame, text="Click a dot to see coordinates", font=('Helvetica',10))
coord_label.grid(row=3, column=0, sticky='w', padx=10, pady=(0,8))


# --- Calibration Panel ---
calib_open = tk.BooleanVar(value=False)
calib_container = tk.Frame(right)

def toggle_calibration():
    if calib_open.get():
        calib_container.grid_remove()
        calib_open.set(False)
        calib_btn.config(text="⚙️ Plate Calibration (optional) ▶")
    else:
        calib_container.grid(row=2, column=0, sticky='nsew')
        calib_open.set(True)
        calib_btn.config(text="⚙️ Plate Calibration (optional) ▼")

calib_btn = tk.Button(right, text="⚙️ Plate Calibration (optional) ▶",
                      command=toggle_calibration, anchor='w')
calib_btn.grid(row=1, column=0, sticky='ew', pady=(0,6))

calib_entries = {}

def build_calibration_grid():
    for widget in calib_container.winfo_children():
        widget.destroy()

    centers = DEFAULT_24WELL_CENTERS
    tk.Label(calib_container, text="Edit X/Y center coordinates for each well",
             font=('Helvetica',10,'italic')).grid(row=0, column=0, pady=(4,2))

    for i, row_letter in enumerate(['A','B','C','D']):
        rowf = tk.Frame(calib_container)
        rowf.grid(row=i+1, column=0, sticky='ew', padx=4, pady=2)
        tk.Label(rowf, text=row_letter, width=4, anchor='center').grid(row=0, column=0)
        for j, col_num in enumerate(['1','2','3','4','5','6']):
            well = row_letter + col_num
            cell = tk.Frame(rowf, bd=1, relief='groove', padx=2, pady=2)
            cell.grid(row=0, column=j+1, padx=2)
            x_val, y_val = centers[well]
            tk.Label(cell, text="X:").grid(row=0, column=0)
            ex = tk.Entry(cell, width=6); ex.insert(0, f"{x_val:.2f}"); ex.grid(row=0, column=1)
            tk.Label(cell, text="Y:").grid(row=1, column=0)
            ey = tk.Entry(cell, width=6); ey.insert(0, f"{y_val:.2f}"); ey.grid(row=1, column=1)
            calib_entries[well] = {'X': ex, 'Y': ey}
            ex.bind("<KeyRelease>", lambda e, w=well: on_calib_change(w))
            ey.bind("<KeyRelease>", lambda e, w=well: on_calib_change(w))

    tk.Button(calib_container, text="Reset Calibration",
              command=reset_calibration).grid(row=6, column=0, sticky='w', padx=4, pady=(6,6))

def reset_calibration():
    for well, xy in DEFAULT_24WELL_CENTERS.items():
        calib_entries[well]['X'].delete(0, tk.END)
        calib_entries[well]['X'].insert(0, f"{xy[0]:.2f}")
        calib_entries[well]['Y'].delete(0, tk.END)
        calib_entries[well]['Y'].insert(0, f"{xy[1]:.2f}")
    set_defaults_from_current_well()
    draw_preview()

def on_calib_change(well_key):
    try:
        x = float(calib_entries[well_key]['X'].get())
        y = float(calib_entries[well_key]['Y'].get())
        DEFAULT_24WELL_CENTERS[well_key] = (x, y)
        draw_preview()
    except ValueError:
        pass

build_calibration_grid()
calib_container.grid_remove()


# --- Live Preview ---
dot_positions = []

def draw_preview():
    canvas.delete("all")
    dot_positions.clear()

    try:
        dots = safe_int(entries["Number of Dots"])
        per_row = safe_int(entries["Dots Per Row"])
        spacing_x = safe_float(entries["Dot Spacing X (mm)"])
        spacing_y = safe_float(entries["Dot Spacing Y (mm)"])
        start_x_val = safe_float(entries["Start X (mm)"])
        start_y_val = safe_float(entries["Start Y (mm)"])
        rows = math.ceil(dots / per_row) if per_row > 0 else 0

        sel_well = well_var.get()
        center_x_mm, center_y_mm = DEFAULT_24WELL_CENTERS.get(sel_well, DEFAULT_24WELL_CENTERS["A1"])
        # Preview only: circle center at 36.55 (X for column A), 52.3 (Y); G-code start stays at center_x_mm, center_y_mm
        preview_cx = center_x_mm - PREVIEW_CENTER_X_OFFSET_MM
        preview_cy = center_y_mm + PREVIEW_CENTER_Y_OFFSET_MM

        cw = int(canvas.winfo_width() or 500)
        ch = int(canvas.winfo_height() or 500)
        px_center_x, px_center_y = cw // 2, ch // 2

        margin = 20
        usable_px = min(cw, ch) - (2 * margin)
        base_scale = usable_px / WELL_DIAM_MM
        scale = base_scale * ((zoom_var.get() or 100.0) / 100.0)
        r_px = (WELL_DIAM_MM / 2.0) * scale

        # Draw well circle
        canvas.create_oval(px_center_x - r_px, px_center_y - r_px,
                           px_center_x + r_px, px_center_y + r_px,
                           outline="#666", width=2)

        dot_r = 3.5 * (scale / base_scale)  # Larger dots for better clicking
        grid_w_mm = max(0.0, (per_row - 1) * spacing_x)
        grid_h_mm = max(0.0, (rows - 1) * spacing_y)

        idx = 0
        for rr in range(rows):
            for cc in range(per_row):
                if idx >= dots:
                    break
                abs_x = start_x_val + cc * spacing_x
                abs_y = start_y_val + rr * spacing_y
                px = px_center_x + (abs_x - preview_cx) * scale
                # Y axis inverted: program Y increases across the well; 46.30 displays at position of 49.30
                py = px_center_y - (abs_y - preview_cy) * scale
                if math.hypot(px - px_center_x, py - px_center_y) < (r_px - dot_r):
                    oval = canvas.create_oval(px - dot_r, py - dot_r, px + dot_r, py + dot_r,
                                              fill="#2196F3", outline="#1976D2", width=1)
                    dot_positions.append((abs_x, abs_y, px, py, oval))
                idx += 1
        
        # Draw spacing indicators between first two dots (if they exist)
        if len(dot_positions) >= 2:
            # Horizontal spacing (X) - between first two dots in row 1
            x1, y1, px1, py1, _ = dot_positions[0]
            x2, y2, px2, py2, _ = dot_positions[1]
            if abs(y1 - y2) < 0.01:  # Same row
                actual_x_spacing = abs(x2 - x1)  # Calculate actual spacing from coordinates
                mid_x = (px1 + px2) / 2
                mid_y = py1 - 15
                canvas.create_line(px1, mid_y, px2, mid_y, fill="#FF9800", width=2, arrow=tk.BOTH)
                canvas.create_text(mid_x, mid_y - 10, text=f"ΔX: {actual_x_spacing:.3f}mm", 
                                 fill="#FF9800", font=('Helvetica', 9, 'bold'))
        
        # Draw Y spacing if we have multiple rows
        if rows > 1 and per_row > 0:
            # Find first dots of first two rows
            if len(dot_positions) >= per_row + 1:
                x1, y1, px1, py1, _ = dot_positions[0]
                x2, y2, px2, py2, _ = dot_positions[per_row]
                actual_y_spacing = abs(y2 - y1)  # Calculate actual spacing from coordinates
                mid_x = px1 - 20
                mid_y = (py1 + py2) / 2
                canvas.create_line(mid_x, py1, mid_x, py2, fill="#4CAF50", width=2, arrow=tk.BOTH)
                canvas.create_text(mid_x - 25, mid_y, text=f"ΔY: {actual_y_spacing:.3f}mm", 
                                 fill="#4CAF50", font=('Helvetica', 9, 'bold'), angle=90)

        size_label.config(text=f"Well Ø {WELL_DIAM_MM:.1f} mm | Grid {grid_w_mm:.2f} × {grid_h_mm:.2f} mm")

    except Exception as e:
        print("Preview error:", e)
        size_label.config(text="Well Ø 15.6 mm | Grid – × – mm")

def on_canvas_click(event):
    # Find closest dot within reasonable distance
    closest_dist = float('inf')
    closest_coords = None
    
    for abs_x, abs_y, px, py, _ in dot_positions:
        dist = math.hypot(event.x - px, event.y - py)
        if dist < 15 and dist < closest_dist:  # Within 15 pixels
            closest_dist = dist
            closest_coords = (abs_x, abs_y)
    
    if closest_coords:
        coord_label.config(text=f"✓ Dot: X = {closest_coords[0]:.3f} mm | Y = {closest_coords[1]:.3f} mm",
                          fg="#D32F2F", font=('Helvetica', 12, 'bold'))  # Dark red, larger, bold
    else:
        coord_label.config(text="Click a dot to see coordinates", 
                          fg="#666666", font=('Helvetica', 10))

canvas.bind("<Button-1>", on_canvas_click)


# --- Field Sync + Well Selection ---
def sync_fields(_=None):
    try:
        dots = safe_int(entries["Number of Dots"])
        per_row = safe_int(entries["Dots Per Row"])
        if dots and per_row:
            expected_rows = math.ceil(dots / per_row)
            current_rows = safe_int(entries["Number of Rows"])
            if expected_rows != current_rows:
                entries["Number of Rows"].delete(0, tk.END)
                entries["Number of Rows"].insert(0, str(expected_rows))
    except:
        pass
    draw_preview()

for k in ["Number of Dots", "Dots Per Row", "Number of Rows",
          "Dot Spacing X (mm)", "Dot Spacing Y (mm)",
          "Start X (mm)", "Start Y (mm)"]:
    entries[k].bind("<KeyRelease>", sync_fields)
    entries[k].bind("<FocusOut>", sync_fields)

def on_well_selected(_=None):
    entries["Well Number"].delete(0, tk.END)
    entries["Well Number"].insert(0, well_var.get())
    set_defaults_from_current_well()
    draw_preview()

well_dropdown.bind('<<ComboboxSelected>>', on_well_selected)

root.after(50, draw_preview)
root.mainloop()
