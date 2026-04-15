ALTER TABLE training_evaluations ADD COLUMN IF NOT EXISTS rating_sound_images INTEGER DEFAULT 5;
ALTER TABLE training_evaluations ADD COLUMN IF NOT EXISTS rating_materials INTEGER DEFAULT 5;
