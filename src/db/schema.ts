import type { DatabaseSync } from 'node:sqlite'

export function applySchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE employees (
      id INTEGER PRIMARY KEY,
      employee_code TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      work_email TEXT NOT NULL UNIQUE,
      country_code TEXT NOT NULL,
      department TEXT NOT NULL,
      job_title TEXT NOT NULL,
      job_level TEXT NOT NULL,
      employment_status TEXT NOT NULL CHECK (employment_status IN ('active', 'leave', 'terminated')),
      gender TEXT NOT NULL CHECK (gender IN ('female', 'male', 'undisclosed')),
      hire_date TEXT NOT NULL,
      termination_date TEXT
    );

    CREATE TABLE salary_bands (
      country_code TEXT NOT NULL,
      job_level TEXT NOT NULL,
      currency TEXT NOT NULL,
      min_minor INTEGER NOT NULL,
      mid_minor INTEGER NOT NULL,
      max_minor INTEGER NOT NULL,
      PRIMARY KEY (country_code, job_level)
    );

    CREATE TABLE salary_records (
      id INTEGER PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      annual_minor INTEGER NOT NULL CHECK (annual_minor > 0),
      currency TEXT NOT NULL,
      effective_date TEXT NOT NULL,
      end_date TEXT,
      reason TEXT NOT NULL CHECK (reason IN ('hire', 'adjustment', 'promotion', 'correction')),
      note TEXT NOT NULL DEFAULT '',
      recorded_at TEXT NOT NULL,
      CHECK (end_date IS NULL OR end_date >= effective_date)
    );

    CREATE INDEX idx_emp_country ON employees(country_code);
    CREATE INDEX idx_emp_dept ON employees(department);
    CREATE INDEX idx_emp_level ON employees(job_level);
    CREATE INDEX idx_emp_status ON employees(employment_status);
    CREATE INDEX idx_emp_name ON employees(full_name);
    CREATE INDEX idx_sal_emp ON salary_records(employee_id, effective_date);
    CREATE UNIQUE INDEX idx_sal_one_open ON salary_records(employee_id) WHERE end_date IS NULL;
  `)
}
