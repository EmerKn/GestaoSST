-- Add replacement periods and cleaning instructions to PPEs table
ALTER TABLE ppes 
ADD COLUMN max_days integer,
ADD COLUMN adjusted_days integer,
ADD COLUMN cleaning_instructions text;
