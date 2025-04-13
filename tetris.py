import pygame
import random

# Initialize Pygame
pygame.init()

# Constants
BLOCK_SIZE = 30
GRID_WIDTH = 10
GRID_HEIGHT = 20
SCREEN_WIDTH = BLOCK_SIZE * (GRID_WIDTH + 6)
SCREEN_HEIGHT = BLOCK_SIZE * GRID_HEIGHT

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
GRAY = (50, 50, 50)  # For the play area border
CYAN = (0, 255, 255)
YELLOW = (255, 255, 0)
MAGENTA = (255, 0, 255)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)
ORANGE = (255, 165, 0)

# Tetromino shapes
SHAPES = [
    [[1, 1, 1, 1]],  # I
    [[1, 1], [1, 1]],  # O
    [[1, 1, 1], [0, 1, 0]],  # T
    [[1, 1, 1], [1, 0, 0]],  # L
    [[1, 1, 1], [0, 0, 1]],  # J
    [[1, 1, 0], [0, 1, 1]],  # S
    [[0, 1, 1], [1, 1, 0]]   # Z
]

COLORS = [CYAN, YELLOW, MAGENTA, ORANGE, BLUE, GREEN, RED]

class Tetris:
    def __init__(self):
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("Tetris")
        self.clock = pygame.time.Clock()
        self.grid = [[0 for _ in range(GRID_WIDTH)] for _ in range(GRID_HEIGHT)]
        self.current_piece = self.new_piece()
        self.game_over = False
        self.score = 0

    def new_piece(self):
        shape = random.randint(0, len(SHAPES) - 1)
        return {
            'shape': SHAPES[shape],
            'color': COLORS[shape],
            'x': GRID_WIDTH // 2 - len(SHAPES[shape][0]) // 2,
            'y': 0
        }

    def valid_move(self, piece, x, y):
        for i in range(len(piece['shape'])):
            for j in range(len(piece['shape'][0])):
                if piece['shape'][i][j]:
                    new_x = x + j
                    new_y = y + i
                    if (new_x < 0 or new_x >= GRID_WIDTH or
                        new_y >= GRID_HEIGHT or
                        (new_y >= 0 and self.grid[new_y][new_x])):
                        return False
        return True

    def merge_piece(self):
        for i in range(len(self.current_piece['shape'])):
            for j in range(len(self.current_piece['shape'][0])):
                if self.current_piece['shape'][i][j]:
                    self.grid[self.current_piece['y'] + i][self.current_piece['x'] + j] = self.current_piece['color']

    def clear_lines(self):
        lines_cleared = 0
        for i in range(GRID_HEIGHT):
            if all(self.grid[i]):
                del self.grid[i]
                self.grid.insert(0, [0 for _ in range(GRID_WIDTH)])
                lines_cleared += 1
        self.score += lines_cleared * 100

    def rotate_piece(self):
        rotated = list(zip(*self.current_piece['shape'][::-1]))
        if self.valid_move({'shape': rotated, 'x': self.current_piece['x'], 'y': self.current_piece['y']},
                          self.current_piece['x'], self.current_piece['y']):
            self.current_piece['shape'] = rotated

    def draw(self):
        self.screen.fill(BLACK)

        # Draw play area border
        play_area_rect = pygame.Rect(0, 0, GRID_WIDTH * BLOCK_SIZE, GRID_HEIGHT * BLOCK_SIZE)
        pygame.draw.rect(self.screen, GRAY, play_area_rect, 2)  # 2 pixel width border

        # Draw grid background (to make the play area visible)
        for i in range(GRID_HEIGHT):
            for j in range(GRID_WIDTH):
                pygame.draw.rect(self.screen, GRAY,
                               (j * BLOCK_SIZE, i * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE), 1)

        # Draw grid blocks
        for i in range(GRID_HEIGHT):
            for j in range(GRID_WIDTH):
                if self.grid[i][j]:
                    pygame.draw.rect(self.screen, self.grid[i][j],
                                   (j * BLOCK_SIZE, i * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1))

        # Draw current piece
        if self.current_piece:
            for i in range(len(self.current_piece['shape'])):
                for j in range(len(self.current_piece['shape'][0])):
                    if self.current_piece['shape'][i][j]:
                        pygame.draw.rect(self.screen, self.current_piece['color'],
                                       ((self.current_piece['x'] + j) * BLOCK_SIZE,
                                        (self.current_piece['y'] + i) * BLOCK_SIZE,
                                        BLOCK_SIZE - 1, BLOCK_SIZE - 1))

        # Draw score
        font = pygame.font.Font(None, 36)
        score_text = font.render(f'Score: {self.score}', True, WHITE)
        self.screen.blit(score_text, (GRID_WIDTH * BLOCK_SIZE + 10, 10))

        pygame.display.flip()

    def run(self):
        fall_time = 0
        fall_speed = 50  # Adjust this value to change difficulty (lower = faster)
        fast_drop_speed = 6  # Speed when down arrow is held (10% slower than before)

        # Key repeat settings
        key_delay = 150  # Milliseconds before key starts repeating
        key_interval = 50  # Milliseconds between repeats

        # Key state tracking
        key_left_time = 0
        key_right_time = 0
        key_down_time = 0
        key_up_time = 0

        # Current game time
        current_time = pygame.time.get_ticks()

        while not self.game_over:
            fall_time += 1
            previous_time = current_time
            current_time = pygame.time.get_ticks()

            # Check for key presses
            keys = pygame.key.get_pressed()

            # Handle events
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    return
                if event.type == pygame.KEYDOWN:
                    # Initial key press actions
                    if event.key == pygame.K_LEFT:
                        if self.valid_move(self.current_piece, self.current_piece['x'] - 1, self.current_piece['y']):
                            self.current_piece['x'] -= 1
                        key_left_time = current_time
                    if event.key == pygame.K_RIGHT:
                        if self.valid_move(self.current_piece, self.current_piece['x'] + 1, self.current_piece['y']):
                            self.current_piece['x'] += 1
                        key_right_time = current_time
                    if event.key == pygame.K_DOWN:
                        if self.valid_move(self.current_piece, self.current_piece['x'], self.current_piece['y'] + 1):
                            self.current_piece['y'] += 1
                        key_down_time = current_time
                    if event.key == pygame.K_UP:
                        self.rotate_piece()
                        key_up_time = current_time
                if event.type == pygame.KEYUP:
                    # Reset key timers when released
                    if event.key == pygame.K_LEFT:
                        key_left_time = 0
                    if event.key == pygame.K_RIGHT:
                        key_right_time = 0
                    if event.key == pygame.K_DOWN:
                        key_down_time = 0
                    if event.key == pygame.K_UP:
                        key_up_time = 0

            # Handle key repeats with delay
            if keys[pygame.K_LEFT] and key_left_time > 0 and current_time - key_left_time > key_delay:
                # Check if it's time for a repeat
                if (current_time - key_left_time - key_delay) % key_interval < (current_time - previous_time):
                    if self.valid_move(self.current_piece, self.current_piece['x'] - 1, self.current_piece['y']):
                        self.current_piece['x'] -= 1

            if keys[pygame.K_RIGHT] and key_right_time > 0 and current_time - key_right_time > key_delay:
                # Check if it's time for a repeat
                if (current_time - key_right_time - key_delay) % key_interval < (current_time - previous_time):
                    if self.valid_move(self.current_piece, self.current_piece['x'] + 1, self.current_piece['y']):
                        self.current_piece['x'] += 1

            if keys[pygame.K_UP] and key_up_time > 0 and current_time - key_up_time > key_delay:
                # Check if it's time for a repeat
                if (current_time - key_up_time - key_delay) % key_interval < (current_time - previous_time):
                    self.rotate_piece()

            # Check if down arrow is being held for fast drop
            current_speed = fast_drop_speed if keys[pygame.K_DOWN] and key_down_time > 0 else fall_speed

            if fall_time >= current_speed:
                if self.valid_move(self.current_piece, self.current_piece['x'], self.current_piece['y'] + 1):
                    self.current_piece['y'] += 1
                else:
                    self.merge_piece()
                    self.clear_lines()
                    self.current_piece = self.new_piece()
                    if not self.valid_move(self.current_piece, self.current_piece['x'], self.current_piece['y']):
                        self.game_over = True
                fall_time = 0

            self.draw()
            self.clock.tick(60)

        # Game over screen
        font = pygame.font.Font(None, 48)
        game_over_text = font.render('Game Over!', True, WHITE)
        self.screen.blit(game_over_text, (SCREEN_WIDTH // 4, SCREEN_HEIGHT // 2))
        pygame.display.flip()
        pygame.time.wait(2000)

if __name__ == '__main__':
    game = Tetris()
    game.run()
    pygame.quit()