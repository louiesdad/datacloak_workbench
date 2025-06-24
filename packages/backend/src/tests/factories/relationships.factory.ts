/**
 * Relationships Factory
 * 
 * Generates test data with proper relationships between entities for testing
 * complex scenarios involving multiple related objects.
 */

import { AbstractFactory, FactoryRegistry, testRandom } from './base.factory';
import { TestUser } from './user.factory';
import { TestDataset } from './dataset.factory';
import { TestSentiment } from './sentiment.factory';
import { TestJob } from './job.factory';

export interface TestProject {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  teamMembers: string[];
  datasets: string[];
  status: 'active' | 'archived' | 'draft';
  settings: {
    privacy: 'public' | 'private' | 'team';
    allowExports: boolean;
    retentionDays: number;
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    totalRecords: number;
    lastActivity: Date;
  };
}

export interface TestWorkspace {
  id: string;
  name: string;
  organization: string;
  projects: TestProject[];
  users: TestUser[];
  quotas: {
    maxProjects: number;
    maxUsers: number;
    storageLimit: number;
    apiCalls: number;
  };
  usage: {
    currentProjects: number;
    currentUsers: number;
    storageUsed: number;
    apiCallsUsed: number;
  };
}

export interface TestAnalysisSession {
  id: string;
  userId: string;
  projectId: string;
  datasetId: string;
  sentimentResults: TestSentiment[];
  jobs: TestJob[];
  status: 'active' | 'completed' | 'failed';
  metrics: {
    recordsProcessed: number;
    processingTime: number;
    accuracy: number;
    confidence: number;
  };
  timeline: Array<{
    timestamp: Date;
    event: string;
    details: any;
  }>;
}

export class RelationshipsFactory extends AbstractFactory<TestWorkspace> {
  build(overrides?: Partial<TestWorkspace>): TestWorkspace {
    const userFactory = FactoryRegistry.get<TestUser>('user');
    const datasetFactory = FactoryRegistry.get<TestDataset>('dataset');
    
    if (!userFactory || !datasetFactory) {
      throw new Error('Required factories not registered. Ensure user and dataset factories are available.');
    }

    const users = userFactory.createMany(testRandom.integer(3, 8));
    const projectCount = testRandom.integer(2, 5);
    const projects: TestProject[] = [];

    for (let i = 0; i < projectCount; i++) {
      const project = this.createProject(users);
      projects.push(project);
    }

    const maxProjects = testRandom.integer(10, 50);
    const maxUsers = testRandom.integer(20, 100);
    const storageLimit = testRandom.integer(1024 * 1024 * 100, 1024 * 1024 * 1000); // 100MB to 1GB

    const base: TestWorkspace = {
      id: this.generateUuid(),
      name: `Workspace ${this.sequence()}`,
      organization: testRandom.choice(['Acme Corp', 'TechStart Inc', 'Data Analytics Ltd', 'Global Insights']),
      projects,
      users,
      quotas: {
        maxProjects,
        maxUsers,
        storageLimit,
        apiCalls: testRandom.integer(10000, 100000)
      },
      usage: {
        currentProjects: projects.length,
        currentUsers: users.length,
        storageUsed: testRandom.integer(0, storageLimit),
        apiCallsUsed: testRandom.integer(0, 5000)
      }
    };

    return this.merge(base, overrides);
  }

  /**
   * Create a project with realistic relationships
   */
  createProject(users: TestUser[]): TestProject {
    const datasetFactory = FactoryRegistry.get<TestDataset>('dataset');
    if (!datasetFactory) {
      throw new Error('Dataset factory not registered');
    }

    const owner = testRandom.choice(users);
    const teamSize = testRandom.integer(1, Math.min(5, users.length));
    const teamMembers = this.selectRandomUsers(users, teamSize, owner.id);
    
    const datasetCount = testRandom.integer(1, 4);
    const datasets: string[] = [];
    let totalRecords = 0;

    for (let i = 0; i < datasetCount; i++) {
      const dataset = datasetFactory.create();
      datasets.push(dataset.id);
      totalRecords += dataset.size;
    }

    const project: TestProject = {
      id: this.generateUuid(),
      name: `Project ${this.sequence()}`,
      description: `Test project for ${owner.firstName} ${owner.lastName}`,
      ownerId: owner.id,
      teamMembers: teamMembers.map(user => user.id),
      datasets,
      status: testRandom.choice(['active', 'archived', 'draft']),
      settings: {
        privacy: testRandom.choice(['public', 'private', 'team']),
        allowExports: testRandom.boolean(0.8),
        retentionDays: testRandom.choice([30, 90, 180, 365])
      },
      metadata: {
        createdAt: this.generateTimestamp(testRandom.integer(0, 90)),
        updatedAt: this.generateTimestamp(testRandom.integer(0, 7)),
        totalRecords,
        lastActivity: this.generateTimestamp(testRandom.integer(0, 3))
      }
    };

    return project;
  }

  /**
   * Select random users excluding the owner
   */
  private selectRandomUsers(users: TestUser[], count: number, excludeId: string): TestUser[] {
    const availableUsers = users.filter(user => user.id !== excludeId);
    const selected: TestUser[] = [];
    
    for (let i = 0; i < Math.min(count, availableUsers.length); i++) {
      const user = testRandom.choice(availableUsers.filter(u => !selected.includes(u)));
      selected.push(user);
    }
    
    return selected;
  }

  /**
   * Create analysis session with full relationships
   */
  createAnalysisSession(overrides?: Partial<TestAnalysisSession>): TestAnalysisSession {
    const userFactory = FactoryRegistry.get<TestUser>('user');
    const datasetFactory = FactoryRegistry.get<TestDataset>('dataset');
    const sentimentFactory = FactoryRegistry.get<TestSentiment>('sentiment');
    const jobFactory = FactoryRegistry.get<TestJob>('job');

    if (!userFactory || !datasetFactory || !sentimentFactory || !jobFactory) {
      throw new Error('Required factories not registered');
    }

    const user = userFactory.create();
    const workspace = this.create();
    const project = testRandom.choice(workspace.projects);
    const dataset = datasetFactory.create();
    
    const recordsToProcess = Math.min(dataset.size, testRandom.integer(10, 100));
    const sentimentResults = sentimentFactory.createBalancedDataset(recordsToProcess);
    
    // Create related jobs
    const jobs = [
      jobFactory.createCompleted({
        type: 'sentiment-analysis',
        payload: {
          datasetId: dataset.id,
          recordCount: recordsToProcess
        },
        result: {
          totalProcessed: recordsToProcess,
          sentimentCounts: this.calculateSentimentCounts(sentimentResults)
        },
        metadata: {
          ...jobFactory.create().metadata,
          userId: user.id,
          requestId: this.generateUuid()
        }
      })
    ];

    // Add export job if results are good
    if (sentimentResults.length > 50) {
      jobs.push(jobFactory.createCompleted({
        type: 'data-export',
        payload: {
          format: 'csv',
          includeAnalysis: true
        },
        metadata: {
          ...jobFactory.create().metadata,
          userId: user.id
        }
      }));
    }

    const processingTime = jobs.reduce((total, job) => total + (job.timing.duration || 0), 0);
    const avgConfidence = sentimentResults.reduce((sum, s) => sum + s.confidence, 0) / sentimentResults.length;

    const base: TestAnalysisSession = {
      id: this.generateUuid(),
      userId: user.id,
      projectId: project.id,
      datasetId: dataset.id,
      sentimentResults,
      jobs,
      status: 'completed',
      metrics: {
        recordsProcessed: recordsToProcess,
        processingTime,
        accuracy: testRandom.float(0.8, 0.95),
        confidence: avgConfidence
      },
      timeline: this.generateTimeline(jobs, sentimentResults)
    };

    return this.merge(base, overrides);
  }

  /**
   * Calculate sentiment counts from results
   */
  private calculateSentimentCounts(sentiments: TestSentiment[]): Record<string, number> {
    const counts = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
    
    sentiments.forEach(sentiment => {
      counts[sentiment.sentiment]++;
    });
    
    return counts;
  }

  /**
   * Generate timeline events for analysis session
   */
  private generateTimeline(jobs: TestJob[], sentiments: TestSentiment[]): TestAnalysisSession['timeline'] {
    const timeline: TestAnalysisSession['timeline'] = [];
    
    // Session started
    timeline.push({
      timestamp: jobs[0]?.timing.createdAt || new Date(),
      event: 'session_started',
      details: { jobCount: jobs.length }
    });

    // Job events
    jobs.forEach(job => {
      if (job.timing.startedAt) {
        timeline.push({
          timestamp: job.timing.startedAt,
          event: 'job_started',
          details: { jobId: job.id, type: job.type }
        });
      }
      
      if (job.timing.completedAt) {
        timeline.push({
          timestamp: job.timing.completedAt,
          event: 'job_completed',
          details: { jobId: job.id, type: job.type, result: job.result }
        });
      }
    });

    // Analysis milestones
    const milestones = [0.25, 0.5, 0.75, 1.0];
    const lastJob = jobs[jobs.length - 1];
    
    if (lastJob?.timing.startedAt && lastJob?.timing.completedAt) {
      const duration = lastJob.timing.completedAt.getTime() - lastJob.timing.startedAt.getTime();
      
      milestones.forEach(milestone => {
        timeline.push({
          timestamp: new Date(lastJob.timing.startedAt!.getTime() + (duration * milestone)),
          event: 'analysis_progress',
          details: {
            progress: milestone * 100,
            processed: Math.floor(sentiments.length * milestone)
          }
        });
      });
    }

    // Sort timeline by timestamp
    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    return timeline;
  }

  /**
   * Create a complete workspace with all relationships
   */
  createCompleteWorkspace(options?: {
    userCount?: number;
    projectCount?: number;
    analysisSessionCount?: number;
  }): {
    workspace: TestWorkspace;
    analysisSessions: TestAnalysisSession[];
  } {
    const workspace = this.create();
    const analysisSessions: TestAnalysisSession[] = [];
    
    const sessionCount = options?.analysisSessionCount || testRandom.integer(3, 8);
    
    for (let i = 0; i < sessionCount; i++) {
      const user = testRandom.choice(workspace.users);
      const project = testRandom.choice(workspace.projects);
      
      const session = this.createAnalysisSession({
        userId: user.id,
        projectId: project.id
      });
      
      analysisSessions.push(session);
    }
    
    return { workspace, analysisSessions };
  }

  /**
   * Create user journey test data (user performing multiple operations)
   */
  createUserJourney(userId?: string): {
    user: TestUser;
    workspace: TestWorkspace;
    projects: TestProject[];
    sessions: TestAnalysisSession[];
  } {
    const userFactory = FactoryRegistry.get<TestUser>('user');
    if (!userFactory) {
      throw new Error('User factory not registered');
    }

    const user = userId ? 
      userFactory.create({ id: userId }) : 
      userFactory.create();
    
    const workspace = this.create();
    
    // Ensure user is in workspace
    if (!workspace.users.find(u => u.id === user.id)) {
      workspace.users.push(user);
    }
    
    // Create projects owned by user
    const projectCount = testRandom.integer(2, 4);
    const userProjects: TestProject[] = [];
    
    for (let i = 0; i < projectCount; i++) {
      const project = this.createProject([user, ...workspace.users]);
      project.ownerId = user.id;
      userProjects.push(project);
      workspace.projects.push(project);
    }
    
    // Create analysis sessions for user
    const sessionCount = testRandom.integer(3, 6);
    const sessions: TestAnalysisSession[] = [];
    
    for (let i = 0; i < sessionCount; i++) {
      const project = testRandom.choice(userProjects);
      const session = this.createAnalysisSession({
        userId: user.id,
        projectId: project.id
      });
      sessions.push(session);
    }
    
    return {
      user,
      workspace,
      projects: userProjects,
      sessions
    };
  }

  /**
   * Create team collaboration scenario
   */
  createTeamCollaboration(): {
    workspace: TestWorkspace;
    sharedProject: TestProject;
    teamSessions: TestAnalysisSession[];
  } {
    const workspace = this.create();
    
    // Pick a project with multiple team members
    const sharedProject = workspace.projects.find(p => p.teamMembers.length > 2) || 
                         workspace.projects[0];
    
    // Create analysis sessions by different team members
    const teamSessions: TestAnalysisSession[] = [];
    const teamMembers = [sharedProject.ownerId, ...sharedProject.teamMembers];
    
    teamMembers.forEach(userId => {
      const session = this.createAnalysisSession({
        userId,
        projectId: sharedProject.id
      });
      teamSessions.push(session);
    });
    
    return {
      workspace,
      sharedProject,
      teamSessions
    };
  }
}

// Export factory instance
export const relationshipsFactory = new RelationshipsFactory();

// Register in factory registry
FactoryRegistry.register('relationships', relationshipsFactory);