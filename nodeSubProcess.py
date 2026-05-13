import subprocess
import time

def kill_process_by_port(port):
    try:
        # Find the PID of the process running on the specified port
        result = subprocess.run(['lsof', '-ti', f':{port}'], capture_output=True, text=True)
        pid = result.stdout.strip()
        if pid:
            # Kill the process
            subprocess.run(['kill', '-9', pid])
            print(f"Process with PID {pid} on port {port} killed successfully.")
        else:
            print(f"No process found running on port {port}.")
    except Exception as e:
        print(f"Error: {e}")

def run_main_script(interval_hours):
    while True:
        print("Starting main script...")
        # Start the main script as a subprocess
        process = subprocess.Popen(["npm", "start"])
        
        # Wait for the specified interval
        print(f"Waiting for {interval_hours} hours...")
        time.sleep(3600)  # Convert hours to seconds
        
        # Terminate the main script process
        print("Terminating main script...")
        process.terminate()
        
        port_to_kill = 5000
        # Call the function to kill the process running on the specified port
        kill_process_by_port(port_to_kill)
        
        process.wait() # Wait for the process to terminate
        print("Main script terminated.")


if __name__ == "__main__":
    interval_hours = 3  # Change this to the desired interval in hours
    run_main_script(interval_hours)
