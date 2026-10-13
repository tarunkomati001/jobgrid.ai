import { processApplication } from "./application-worker";

interface QueuedJob {
  applicationId: string;
  userId: string;
  jobId: string;
  url: string;
  additionalAnswers?: Record<string, string>;
}

class ApplicationQueue {
  private queue: QueuedJob[] = [];
  private isProcessing = false;

  /**
   * Adds a job to the processing queue.
   */
  public add(job: QueuedJob): void {
    console.log(`📥 Queueing application [${job.applicationId}] for URL: ${job.url}`);
    this.queue.push(job);
    this.triggerProcessing();
  }

  /**
   * Triggers the background worker loop if not already running.
   */
  private async triggerProcessing(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    
    console.log("⚙️ Starting background queue worker loop...");
    while (this.queue.length > 0) {
      const jobsToProcess = [...this.queue];
      this.queue = [];

      const promises = jobsToProcess.map(async (nextJob, index) => {
        // Stagger browser launches to prevent CPU spikes
        await new Promise(resolve => setTimeout(resolve, index * 2500));
        try {
          console.log(`🔄 Processing job from queue in parallel: Application [${nextJob.applicationId}]`);
          await processApplication(
            nextJob.applicationId,
            nextJob.userId,
            nextJob.jobId,
            nextJob.url,
            nextJob.additionalAnswers
          );
        } catch (error) {
          console.error(`❌ Error processing queued job [${nextJob.applicationId}]:`, error);
        }
      });

      await Promise.all(promises);
    }
    
    console.log("⚙️ Queue empty. Background worker idling.");
    this.isProcessing = false;
  }

  /**
   * Returns current queue statistics.
   */
  public getStats() {
    return {
      pendingJobs: this.queue.length,
      isProcessing: this.isProcessing,
    };
  }
}

export const applicationQueue = new ApplicationQueue();
