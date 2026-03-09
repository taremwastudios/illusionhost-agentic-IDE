save_modification_state("Added distance calculation function to controller.py")
import math

def calculate_distance(point1, point2):
    return math.sqrt((point2[0] - point1[0]) ** 2 + (point2[1] - point1[1]) ** 2)

commit_and_push()