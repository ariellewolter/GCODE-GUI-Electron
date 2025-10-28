import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import datetime

# Define well bottom height constant - DO NOT GO BELOW THIS OR NEEDLE WILL BREAK
WELL_BOTTOM_Z = 2.35  # mm - absolute minimum safe Z height

# Default Z offsets from well bottom
DEFAULT_LOWER_Z_OFFSET = 1.5   # mm above well bottom
DEFAULT_UPPER_Z_OFFSET = 1.51  # mm above well bottom

# Define standard well positions for 24-well plate
WELL_POSITIONS = {
    'A1': (37.55, 46.3),
    'A2': (37.55, 65.6),
    'A3': (37.55, 84.9),
    'A4': (37.55, 104.2),
    'A5': (37.55, 123.5),
    'A6': (37.55, 142.8),
    'B1': (56.85, 46.3),
    'B2': (56.85, 65.6),
    'B3': (56.85, 84.9),
    'B4': (56.85, 104.2),
    'B5': (56.85, 123.5),
    'B6': (56.85, 142.8),
    'C1': (76.15, 46.3),
    'C2': (76.15, 65.6),
    'C3': (76.15, 84.9),
    'C4': (76.15, 104.2),
    'C5': (76.15, 123.5),
    'C6': (76.15, 142.8),
    'D1': (95.45, 46.3),
    'D2': (95.45, 65.6),
    'D3': (95.45, 84.9),
    'D4': (95.45, 104.2),
    'D5': (95.45, 123.5),
    'D6': (95.45, 142.8),
    'Custom': (0.0, 0.0)  # Default for custom entry
}


def generate_dot_series_gcode(start_x, start_y, num_dots, dot_spacing_x, dot_spacing_y, lower_z, upper_z, well_number, dots_per_row, output_path):
    # Get the current date and time
    current_date = datetime.datetime.now().strftime("%d-%b-%Y %H:%M:%S")

    # Calculate absolute Z positions from offsets
    absolute_lower_z = WELL_BOTTOM_Z + lower_z
    absolute_upper_z = WELL_BOTTOM_Z + upper_z
    
    with open(output_path, 'w') as file:
        # Custom heading with dynamic date of generation and customizable well number
        file.write(f"; Experiment g-Code developed on: {current_date}\n")
        file.write(f"; Lower Z offset: {lower_z:.2f} mm (Absolute Z: {absolute_lower_z:.2f} mm)\n")
        file.write(f"; Upper Z offset: {upper_z:.2f} mm (Absolute Z: {absolute_upper_z:.2f} mm)\n")
        file.write("; Working on 24 WELL TRAY\n\n")
        file.write(f"; Well number {well_number}\n")

        # G-code file header
        file.write("G21 ; Set units to millimeters\n")
        file.write("G90 ; Use absolute positioning\n")
        file.write("M83 ; Set extruder to relative mode\n")

        for i in range(num_dots):
            x = start_x + (i % dots_per_row) * dot_spacing_x
            y = start_y + (i // dots_per_row) * dot_spacing_y

            # Write custom header and commands for each dot
            file.write(f"\n; Dot number {i+1}\n")
            file.write(f"G1 X{x:.2f} Y{y:.2f} F350 ; Move to dot position\n")
            file.write("G4 P200 ; Dwell for 200ms\n")
            file.write("G1 Z3.28 F250 ; Lower to dot height\n")
            file.write("G4 P200 ; Dwell for 200ms\n")
            file.write(f"G1 Z{absolute_lower_z:.2f} F30 ; Lower to printing height\n")
            file.write("G4 P500 ; Dwell for 500ms\n")
            file.write(f"G1 Z{absolute_upper_z:.2f} E0.0105 F3 ; Extrude dot\n")
            file.write("G4 S1.5 ; Dwell for 1.5 seconds\n")
            file.write("G1 Z2.88 F80 ; Raise nozzle slightly after printing\n")
            file.write("G4 P750 ; Dwell for 750ms\n")
            file.write("G1 Z5 F350 ; Move to safe height\n")
            file.write("G4 P200 ; Dwell for 200ms\n")

        # Add final commands
        file.write("\nG1 Z23 F250\n")
        file.write("G4 P100\n")

    messagebox.showinfo(
        "Success", f"G-code successfully generated and saved as {output_path}")


def on_well_selected(event):
    """Update start X and Y coordinates when a well is selected from dropdown"""
    selected_well = well_dropdown.get()
    if selected_well in WELL_POSITIONS:
        x, y = WELL_POSITIONS[selected_well]
        start_x_entry.delete(0, tk.END)
        start_x_entry.insert(0, str(x))
        start_y_entry.delete(0, tk.END)
        start_y_entry.insert(0, str(y))
        # Also update the well number field
        if selected_well != 'Custom':
            well_number_entry.delete(0, tk.END)
            well_number_entry.insert(0, selected_well)


def save_gcode():
    try:
        # Validate and parse inputs
        start_x = float(start_x_entry.get())
        start_y = float(start_y_entry.get())
        num_dots = int(num_dots_entry.get())
        dot_spacing_x = float(dot_spacing_x_entry.get())
        dot_spacing_y = float(dot_spacing_y_entry.get())
        lower_z = float(lower_z_entry.get())
        upper_z = float(upper_z_entry.get())
        well_number = well_number_entry.get().strip()
        dots_per_row = int(dots_per_row_entry.get())

        # Validation checks
        if not well_number:
            messagebox.showerror("Error", "Well number cannot be empty.")
            return
        
        if num_dots <= 0:
            messagebox.showerror("Error", "Number of dots must be greater than 0.")
            return
        
        if dots_per_row <= 0:
            messagebox.showerror("Error", "Dots per row must be greater than 0.")
            return
        
        # Safety check: prevent negative offsets (would go below well bottom and break needle!)
        if lower_z < 0:
            messagebox.showerror("Error", f"Lower Z offset ({lower_z:.2f} mm) is negative!\nThis would go below the well bottom and BREAK THE NEEDLE!")
            return
        
        if upper_z < 0:
            messagebox.showerror("Error", f"Upper Z offset ({upper_z:.2f} mm) is negative!\nThis would go below the well bottom and BREAK THE NEEDLE!")
            return

        # Create the output file path using the well number and lower Z entry
        output_filename = f"well_{well_number}_lower_z_{lower_z:.2f}.txt"
        output_path = filedialog.asksaveasfilename(defaultextension=".txt",
                                                   filetypes=[
                                                       ("Text files", "*.txt")],
                                                   initialdir="~/",
                                                   title="Save G-code as",
                                                   initialfile=output_filename)
        if output_path:
            generate_dot_series_gcode(start_x, start_y, num_dots, dot_spacing_x,
                                      dot_spacing_y, lower_z, upper_z, well_number, dots_per_row, output_path)
    except ValueError as e:
        messagebox.showerror(
            "Error", "Invalid input. Please check that all numeric fields contain valid numbers.")
    except Exception as e:
        messagebox.showerror("Error", f"An error occurred: {str(e)}")


# Tkinter GUI setup
root = tk.Tk()
root.title("G-code Generator - 24 Well Plate")

# Force window to front on macOS
root.lift()
root.attributes('-topmost', True)
root.after_idle(root.attributes, '-topmost', False)

# Well position dropdown
tk.Label(root, text="Select Well Position:", font=('Helvetica', 11, 'bold')).pack(anchor='w', padx=20, pady=(20, 5))
well_dropdown = ttk.Combobox(root, values=list(WELL_POSITIONS.keys()), state='readonly', width=40)
well_dropdown.set('A1')
well_dropdown.pack(padx=20, pady=(0, 10))
well_dropdown.bind('<<ComboboxSelected>>', on_well_selected)

# Entry widgets - create them all first
tk.Label(root, text="Start X (mm):").pack(anchor='w', padx=20, pady=(5, 0))
start_x_entry = tk.Entry(root, width=42)
start_x_entry.pack(padx=20, pady=(0, 5))

tk.Label(root, text="Start Y (mm):").pack(anchor='w', padx=20, pady=(5, 0))
start_y_entry = tk.Entry(root, width=42)
start_y_entry.pack(padx=20, pady=(0, 5))

tk.Label(root, text="Number of Dots:").pack(anchor='w', padx=20, pady=(5, 0))
num_dots_entry = tk.Entry(root, width=42)
num_dots_entry.pack(padx=20, pady=(0, 5))

tk.Label(root, text="Dot Spacing X (mm):").pack(anchor='w', padx=20, pady=(5, 0))
dot_spacing_x_entry = tk.Entry(root, width=42)
dot_spacing_x_entry.pack(padx=20, pady=(0, 5))

tk.Label(root, text="Dot Spacing Y (mm):").pack(anchor='w', padx=20, pady=(5, 0))
dot_spacing_y_entry = tk.Entry(root, width=42)
dot_spacing_y_entry.pack(padx=20, pady=(0, 5))

tk.Label(root, text=f"⚠️  Well Bottom: {WELL_BOTTOM_Z} mm (built-in)", 
         fg='blue', font=('Helvetica', 9, 'bold')).pack(anchor='w', padx=20, pady=(10, 5))

tk.Label(root, text="Lower Z Offset (mm above well bottom):").pack(anchor='w', padx=20, pady=(5, 0))
lower_z_entry = tk.Entry(root, width=42)
lower_z_entry.pack(padx=20, pady=(0, 5))

tk.Label(root, text="Upper Z Offset (mm above well bottom):").pack(anchor='w', padx=20, pady=(5, 0))
upper_z_entry = tk.Entry(root, width=42)
upper_z_entry.pack(padx=20, pady=(0, 5))

tk.Label(root, text="Well Number:").pack(anchor='w', padx=20, pady=(5, 0))
well_number_entry = tk.Entry(root, width=42)
well_number_entry.pack(padx=20, pady=(0, 5))

tk.Label(root, text="Dots Per Row:").pack(anchor='w', padx=20, pady=(5, 0))
dots_per_row_entry = tk.Entry(root, width=42)
dots_per_row_entry.pack(padx=20, pady=(0, 5))

# Set default values
num_dots_entry.insert(0, "100")
dot_spacing_x_entry.insert(0, "0.3")
dot_spacing_y_entry.insert(0, "1.5")
lower_z_entry.insert(0, str(DEFAULT_LOWER_Z_OFFSET))  # 1.5mm offset above well bottom
upper_z_entry.insert(0, str(DEFAULT_UPPER_Z_OFFSET))  # 1.51mm offset above well bottom
dots_per_row_entry.insert(0, "10")

# Initialize with default well position (A1)
default_x, default_y = WELL_POSITIONS['A1']
start_x_entry.insert(0, str(default_x))
start_y_entry.insert(0, str(default_y))
well_number_entry.insert(0, 'A1')

# Save G-code button
tk.Button(root, text="Save G-code", command=save_gcode, bg='#4CAF50', fg='white', 
          font=('Helvetica', 12, 'bold'), pady=10).pack(padx=20, pady=20, fill='x')

root.mainloop()
