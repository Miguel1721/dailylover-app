from celery import Celery
import os

# Load redis url from environment, fall back to localhost if not set
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "dailylover_tasks",
    broker=redis_url,
    backend=redis_url,
)

# Standard Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Bogota",
    enable_utc=True,
    imports=(
        # Register task modules here as they are created:
        # "app.tasks.scheduled",
    )
)

@celery_app.task(name="tasks.test_celery")
def test_celery():
    return "Celery is up and running for Daily Lover!"
