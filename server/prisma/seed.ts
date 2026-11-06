import {
  PrismaClient,
  RoleType,
  EnrollmentStatus,
  MaterialType,
  AttendanceStatus,
  AssessmentType,
  PublicationState,
  NotificationCategory,
  PostScope,
  PostSection,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The demo seed is not allowed in production. Use migrations and an approved provisioning process.');
  }
  console.log('--- Seeding EduSphere Database ---');

  // 1. Create Institution with default attendance threshold (Rule 1 & Rule 6)
  const institution = await prisma.institution.upsert({
    where: { code: 'STANFORD_TECH' },
    update: {
      defaultAttendanceThreshold: 75.0,
    },
    create: {
      name: 'Stanford Institute of Technology',
      code: 'STANFORD_TECH',
      domain: 'stanford-tech.edu',
      logoUrl: 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=200&q=80',
      defaultAttendanceThreshold: 75.0,
      isActive: true,
    },
  });
  console.log(`✓ Institution created/ready: ${institution.name} (Code: ${institution.code})`);

  // Default Passwords (hashed with 12 rounds)
  const defaultPassword = await bcrypt.hash('Password123!', 12);

  // 2. Create Admin User
  const admin = await prisma.user.upsert({
    where: {
      institutionId_email: {
        institutionId: institution.id,
        email: 'admin@stanford-tech.edu',
      },
    },
    update: {},
    create: {
      institutionId: institution.id,
      email: 'admin@stanford-tech.edu',
      passwordHash: defaultPassword,
      firstName: 'Arthur',
      lastName: 'Pendleton',
      role: RoleType.ADMIN,
      mustResetPassword: false,
      isActive: true,
    },
  });
  console.log(`✓ Admin user: ${admin.email}`);

  // 3. Create Department & Program
  const department = await prisma.department.upsert({
    where: {
      institutionId_code: {
        institutionId: institution.id,
        code: 'CS',
      },
    },
    update: {},
    create: {
      institutionId: institution.id,
      name: 'Computer Science & Engineering',
      code: 'CS',
    },
  });

  const program = await prisma.program.upsert({
    where: {
      institutionId_code: {
        institutionId: institution.id,
        code: 'BTECH_CSE',
      },
    },
    update: {},
    create: {
      institutionId: institution.id,
      departmentId: department.id,
      name: 'B.Tech in Computer Science',
      code: 'BTECH_CSE',
    },
  });

  // 4. Create Academic Year, Semester, Section
  const academicYear = await prisma.academicYear.upsert({
    where: {
      institutionId_name: {
        institutionId: institution.id,
        name: '2025-2026',
      },
    },
    update: {},
    create: {
      institutionId: institution.id,
      name: '2025-2026',
      startDate: new Date('2025-08-01'),
      endDate: new Date('2026-05-31'),
      isCurrent: true,
    },
  });

  const semester = await prisma.semester.upsert({
    where: {
      institutionId_programId_academicYearId_semesterNumber: {
        institutionId: institution.id,
        programId: program.id,
        academicYearId: academicYear.id,
        semesterNumber: 5,
      },
    },
    update: {},
    create: {
      institutionId: institution.id,
      academicYearId: academicYear.id,
      programId: program.id,
      semesterNumber: 5,
      name: 'Semester 5',
      startDate: new Date('2025-08-01'),
      endDate: new Date('2025-12-20'),
    },
  });

  const section = await prisma.section.upsert({
    where: {
      institutionId_semesterId_name: {
        institutionId: institution.id,
        semesterId: semester.id,
        name: 'Section A',
      },
    },
    update: {},
    create: {
      institutionId: institution.id,
      semesterId: semester.id,
      name: 'Section A',
    },
  });

  // 5. Create Subject
  const subject = await prisma.subject.upsert({
    where: {
      institutionId_code: {
        institutionId: institution.id,
        code: 'CS301',
      },
    },
    update: {},
    create: {
      institutionId: institution.id,
      semesterId: semester.id,
      name: 'Distributed Systems & Cloud Computing',
      code: 'CS301',
      credits: 4.0,
    },
  });

  // 6. Create Faculty User & Assignment
  const faculty = await prisma.user.upsert({
    where: {
      institutionId_email: {
        institutionId: institution.id,
        email: 'faculty@stanford-tech.edu',
      },
    },
    update: {},
    create: {
      institutionId: institution.id,
      email: 'faculty@stanford-tech.edu',
      passwordHash: defaultPassword,
      firstName: 'Dr. Elena',
      lastName: 'Rostova',
      role: RoleType.FACULTY,
      departmentId: department.id,
      mustResetPassword: false,
      isActive: true,
    },
  });
  console.log(`✓ Faculty user: ${faculty.email}`);

  await prisma.facultyAssignment.upsert({
    where: {
      institutionId_facultyId_subjectId_sectionId: {
        institutionId: institution.id,
        facultyId: faculty.id,
        subjectId: subject.id,
        sectionId: section.id,
      },
    },
    update: {},
    create: {
      institutionId: institution.id,
      facultyId: faculty.id,
      subjectId: subject.id,
      sectionId: section.id,
    },
  });

  // 7. Create Student User & Enrollment
  const student = await prisma.user.upsert({
    where: {
      institutionId_email: {
        institutionId: institution.id,
        email: 'student@stanford-tech.edu',
      },
    },
    update: {},
    create: {
      institutionId: institution.id,
      email: 'student@stanford-tech.edu',
      passwordHash: defaultPassword,
      firstName: 'Lucas',
      lastName: 'Vance',
      role: RoleType.STUDENT,
      mustResetPassword: false, // Default active for immediate demo
      isActive: true,
    },
  });
  console.log(`✓ Student user: ${student.email}`);

  await prisma.studentEnrollment.upsert({
    where: {
      institutionId_sectionId_studentId: {
        institutionId: institution.id,
        sectionId: section.id,
        studentId: student.id,
      },
    },
    update: {},
    create: {
      institutionId: institution.id,
      studentId: student.id,
      sectionId: section.id,
      rollNumber: 'CS2025-042',
      status: EnrollmentStatus.ACTIVE,
    },
  });

  // 8. Grade Rules
  const standardGrades = [
    { gradeLetter: 'A+', gradePoint: 10.0, minPercentage: 90.0, maxPercentage: 100.0, isPass: true },
    { gradeLetter: 'A', gradePoint: 9.0, minPercentage: 80.0, maxPercentage: 89.99, isPass: true },
    { gradeLetter: 'B', gradePoint: 8.0, minPercentage: 70.0, maxPercentage: 79.99, isPass: true },
    { gradeLetter: 'C', gradePoint: 7.0, minPercentage: 60.0, maxPercentage: 69.99, isPass: true },
    { gradeLetter: 'D', gradePoint: 6.0, minPercentage: 50.0, maxPercentage: 59.99, isPass: true },
    { gradeLetter: 'F', gradePoint: 0.0, minPercentage: 0.0, maxPercentage: 49.99, isPass: false },
  ];

  for (const rule of standardGrades) {
    await prisma.gradeRule.upsert({
      where: {
        institutionId_gradeLetter: {
          institutionId: institution.id,
          gradeLetter: rule.gradeLetter,
        },
      },
      update: rule,
      create: {
        institutionId: institution.id,
        ...rule,
      },
    });
  }
  console.log('✓ Grade rules configured (A+, A, B, C, D, F)');

  // 9. Unit & Study Materials
  const unit1 = await prisma.unit.upsert({
    where: {
      institutionId_subjectId_unitNumber: {
        institutionId: institution.id,
        subjectId: subject.id,
        unitNumber: 1,
      },
    },
    update: {},
    create: {
      institutionId: institution.id,
      subjectId: subject.id,
      unitNumber: 1,
      title: 'Unit 1: Foundations of Distributed Consensus & Fault Tolerance',
      description: 'Covers Paxos, Raft consensus algorithm, and state machine replication.',
    },
  });

  const material = await prisma.studyMaterial.upsert({
    where: { id: 'mat-cs301-raft-01' },
    update: {},
    create: {
      id: 'mat-cs301-raft-01',
      institutionId: institution.id,
      subjectId: subject.id,
      unitId: unit1.id,
      createdById: faculty.id,
      title: 'Raft Consensus Protocol & Safety Invariants',
      description: 'Comprehensive lecture slides and technical notes on leader election and log replication.',
      type: MaterialType.PDF,
      allowDownload: true,
      currentVersion: 1,
      targetSections: {
        create: {
          sectionId: section.id,
        },
      },
      versions: {
        create: {
          institutionId: institution.id,
          versionNumber: 1,
          originalFilename: 'raft_consensus_invariants.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 1024 * 350,
          s3Key: 'materials/raft_consensus_invariants.pdf',
          changeNote: 'Initial lecture release',
        },
      },
    },
  });

  const uploadDir = path.resolve(process.cwd(), 'uploads/materials');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const samplePdfPath = path.join(uploadDir, 'raft_consensus_invariants.pdf');
  if (!fs.existsSync(samplePdfPath)) {
    const pdfContent = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 170 >>\nstream\nBT\n/F1 20 Tf\n50 720 Td\n(Raft Consensus Protocol & Safety Invariants) Tj\n/F1 12 Tf\n0 -30 Td\n(Stanford Institute of Technology - CS301 Lecture Notes) Tj\n0 -25 Td\n(1. Election Safety: At most one leader can be elected in a given term.) Tj\n0 -20 Td\n(2. Leader Append-Only: A leader never overwrites or truncates its log.) Tj\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000466 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n545\n%%EOF\n';
    fs.writeFileSync(samplePdfPath, pdfContent);
  }

  console.log(`✓ Study material seeded: ${material.title}`);

  // 10. Classroom Canvas Session
  const canvasSession = await prisma.classroomSession.upsert({
    where: { id: 'canvas-cs301-session-01' },
    update: { completedAt: new Date('2025-09-15T10:30:00Z') },
    create: {
      id: 'canvas-cs301-session-01',
      institutionId: institution.id,
      subjectId: subject.id,
      sectionId: section.id,
      facultyId: faculty.id,
      title: 'Interactive Board: Byzantine Generals & Quorum Slices',
      sessionDate: new Date('2025-09-15T09:30:00Z'),
      completedAt: new Date('2025-09-15T10:30:00Z'),
      allowDownload: true,
      pages: {
        create: [
          {
            institutionId: institution.id,
            pageNumber: 1,
            strokesJson: [
              {
                id: 'stroke-1',
                tool: 'pen',
                color: '#6366f1',
                size: 3,
                points: [120, 100, 150, 140, 220, 180, 310, 200],
              },
              {
                id: 'stroke-2',
                tool: 'text',
                text: 'Leader Election: Terms & Monotonic Clocks',
                x: 120,
                y: 80,
                fontSize: 18,
                fill: '#e2e8f0',
              },
            ],
          },
        ],
      },
    },
  });
  console.log(`✓ Digital Canvas session seeded: ${canvasSession.title}`);

  // 11. Attendance Sessions & Records (10 sessions, 8 present, 1 late, 1 absent -> 85%)
  const attendanceDates = [
    { date: '2025-08-10', status: AttendanceStatus.PRESENT, topic: 'Introduction to Distributed Systems' },
    { date: '2025-08-12', status: AttendanceStatus.PRESENT, topic: 'Clocks, Skew, and Lamport Timestamps' },
    { date: '2025-08-17', status: AttendanceStatus.PRESENT, topic: 'Vector Clocks and Causality' },
    { date: '2025-08-19', status: AttendanceStatus.PRESENT, topic: 'Global State & Chandy-Lamport Algorithm' },
    { date: '2025-08-24', status: AttendanceStatus.LATE, topic: 'Mutual Exclusion in Distributed Systems' },
    { date: '2025-08-26', status: AttendanceStatus.PRESENT, topic: 'Leader Election Algorithms' },
    { date: '2025-08-31', status: AttendanceStatus.PRESENT, topic: 'Consensus & FLP Impossibility Theorem' },
    { date: '2025-09-02', status: AttendanceStatus.ABSENT, topic: 'Paxos Made Simple Walkthrough' },
    { date: '2025-09-07', status: AttendanceStatus.PRESENT, topic: 'Multi-Paxos and Quorums' },
    { date: '2025-09-09', status: AttendanceStatus.PRESENT, topic: 'Raft Consensus: Leader Election' },
  ];

  for (let i = 0; i < attendanceDates.length; i++) {
    const item = attendanceDates[i];
    const sessionDate = new Date(`${item.date}T10:00:00Z`);

    const attSession = await prisma.attendanceSession.upsert({
      where: {
        institutionId_subjectId_sectionId_sessionDate_periodNumber: {
          institutionId: institution.id,
          subjectId: subject.id,
          sectionId: section.id,
          sessionDate,
          periodNumber: 1,
        },
      },
      update: {},
      create: {
        institutionId: institution.id,
        subjectId: subject.id,
        sectionId: section.id,
        facultyId: faculty.id,
        sessionDate,
        periodNumber: 1,
        topicCovered: item.topic,
        isCompleted: true,
      },
    });

    await prisma.attendanceRecord.upsert({
      where: {
        attendanceSessionId_studentId: {
          attendanceSessionId: attSession.id,
          studentId: student.id,
        },
      },
      update: {
        status: item.status,
      },
      create: {
        institutionId: institution.id,
        attendanceSessionId: attSession.id,
        studentId: student.id,
        status: item.status,
      },
    });
  }
  console.log('✓ Attendance records seeded (10 sessions, aggregated 85% attendance for Lucas Vance)');

  // 12. Assessments & Marks
  // Assessment 1: Internal 1 (Published)
  const assess1 = await prisma.assessment.upsert({
    where: { id: 'assess-cs301-internal-1' },
    update: {},
    create: {
      id: 'assess-cs301-internal-1',
      institutionId: institution.id,
      subjectId: subject.id,
      sectionId: section.id,
      facultyId: faculty.id,
      name: 'Midterm Internal Exam 1',
      type: AssessmentType.INTERNAL_1,
      maxMarks: 50,
      weightage: 20,
      state: PublicationState.PUBLISHED,
      publishedAt: new Date('2025-09-20T12:00:00Z'),
    },
  });

  await prisma.studentMark.upsert({
    where: {
      assessmentId_studentId: {
        assessmentId: assess1.id,
        studentId: student.id,
      },
    },
    update: {},
    create: {
      institutionId: institution.id,
      assessmentId: assess1.id,
      studentId: student.id,
      score: 44.5,
      gradeLetter: 'A',
      isAbsent: false,
      remarks: 'Strong grasp of consensus algorithms and CAP theorem tradeoffs.',
    },
  });

  // Assessment 2: Practical Lab 1 (Published)
  const assess2 = await prisma.assessment.upsert({
    where: { id: 'assess-cs301-practical-1' },
    update: {},
    create: {
      id: 'assess-cs301-practical-1',
      institutionId: institution.id,
      subjectId: subject.id,
      sectionId: section.id,
      facultyId: faculty.id,
      name: 'Lab Practical 1 - Raft Cluster Implementation',
      type: AssessmentType.PRACTICAL,
      maxMarks: 25,
      weightage: 15,
      state: PublicationState.PUBLISHED,
      publishedAt: new Date('2025-09-25T14:00:00Z'),
    },
  });

  await prisma.studentMark.upsert({
    where: {
      assessmentId_studentId: {
        assessmentId: assess2.id,
        studentId: student.id,
      },
    },
    update: {},
    create: {
      institutionId: institution.id,
      assessmentId: assess2.id,
      studentId: student.id,
      score: 23.0,
      gradeLetter: 'A+',
      isAbsent: false,
      remarks: 'All 15 automated partition and crash recovery unit tests passed.',
    },
  });

  // Assessment 3: Internal 2 (DRAFT - testing Rule 5: students cannot see draft marks)
  await prisma.assessment.upsert({
    where: { id: 'assess-cs301-internal-2' },
    update: {},
    create: {
      id: 'assess-cs301-internal-2',
      institutionId: institution.id,
      subjectId: subject.id,
      sectionId: section.id,
      facultyId: faculty.id,
      name: 'Internal Exam 2 (Draft)',
      type: AssessmentType.INTERNAL_2,
      maxMarks: 50,
      weightage: 20,
      state: PublicationState.DRAFT,
    },
  });

  console.log('✓ Assessments & Marks seeded (Published & Draft states verified)');

  // 13. Institution periods and timetable slots (Days 1 to 6)
  const period1 = await prisma.period.upsert({
    where: { institutionId_number: { institutionId: institution.id, number: 1 } },
    update: { name: 'Morning Lecture', startTime: '09:00', endTime: '10:00', isActive: true },
    create: { institutionId: institution.id, number: 1, name: 'Morning Lecture', startTime: '09:00', endTime: '10:00' },
  });
  const period2 = await prisma.period.upsert({
    where: { institutionId_number: { institutionId: institution.id, number: 2 } },
    update: { name: 'Late Morning', startTime: '10:15', endTime: '11:15', isActive: true },
    create: { institutionId: institution.id, number: 2, name: 'Late Morning', startTime: '10:15', endTime: '11:15' },
  });
  for (let day = 1; day <= 6; day++) {
    await prisma.timetableSlot.upsert({
      where: {
        institutionId_sectionId_dayOfWeek_periodNumber: {
          institutionId: institution.id,
          sectionId: section.id,
          dayOfWeek: day,
          periodNumber: 1,
        },
      },
      update: { periodId: period1.id, startTime: period1.startTime, endTime: period1.endTime },
      create: {
        institutionId: institution.id,
        sectionId: section.id,
        subjectId: subject.id,
        facultyId: faculty.id,
        periodId: period1.id,
        dayOfWeek: day,
        periodNumber: 1,
        startTime: '09:00',
        endTime: '10:00',
        roomNumber: 'Room 302',
      },
    });

    await prisma.timetableSlot.upsert({
      where: {
        institutionId_sectionId_dayOfWeek_periodNumber: {
          institutionId: institution.id,
          sectionId: section.id,
          dayOfWeek: day,
          periodNumber: 2,
        },
      },
      update: { periodId: period2.id, startTime: period2.startTime, endTime: period2.endTime },
      create: {
        institutionId: institution.id,
        sectionId: section.id,
        subjectId: subject.id,
        facultyId: faculty.id,
        periodId: period2.id,
        dayOfWeek: day,
        periodNumber: 2,
        startTime: '10:15',
        endTime: '11:15',
        roomNumber: 'Cloud Computing Lab 4',
      },
    });
  }
  console.log('✓ Timetable slots seeded for Section A (Periods 1 & 2 across Mon-Sat)');

  // 14. Campus Announcements
  await prisma.announcement.upsert({
    where: { id: 'ann-stanford-tech-01' },
    update: {},
    create: {
      id: 'ann-stanford-tech-01',
      institutionId: institution.id,
      authorId: admin.id,
      title: 'Mandatory Institutional Attendance Policy Reminder',
      content: 'All students are reminded that a minimum of 75.0% attendance is mandatory across all subjects. Shortage notifications will be triggered automatically.',
      targetRole: null, // Broadcast to all
      isPinned: true,
    },
  });

  await prisma.announcement.upsert({
    where: { id: 'ann-stanford-tech-02' },
    update: {},
    create: {
      id: 'ann-stanford-tech-02',
      institutionId: institution.id,
      authorId: faculty.id,
      title: 'CS301 Distributed Systems Midterm Review & Lab Practical',
      content: 'The Raft consensus cluster practical results have been graded. Review your scores in the academic portal. Makeup lab sessions will be scheduled next Tuesday.',
      targetRole: RoleType.STUDENT,
      isPinned: false,
    },
  });
  console.log('✓ Campus announcements seeded (Pinned circulars & faculty notice)');

  // 15. Doubts (Q&A)
  // Doubt 1: Unanswered doubt from Lucas Vance with code snippet
  await prisma.doubt.upsert({
    where: { id: 'doubt-cs301-lucas-01' },
    update: {},
    create: {
      id: 'doubt-cs301-lucas-01',
      institutionId: institution.id,
      subjectId: subject.id,
      studentId: student.id,
      title: 'Term monotonicity in Raft leader election',
      content: 'If two candidate nodes start an election in term T concurrently, can a node with term T-1 vote for both or does it reject votes with an older term?',
      codeSnippet: `def handle_request_vote(self, candidate_id, term, last_log_index, last_log_term):
    if term < self.current_term:
        return False, self.current_term
    if term > self.current_term:
        self.current_term = term
        self.voted_for = None
    if (self.voted_for is None or self.voted_for == candidate_id) and self.is_up_to_date(last_log_index, last_log_term):
        self.voted_for = candidate_id
        return True, self.current_term
    return False, self.current_term`,
      codeLanguage: 'python',
      tags: ['raft', 'consensus', 'distributed-systems'],
      isAnonymous: false,
      isResolved: false,
      upvotesCount: 3,
    },
  });

  // Doubt 2: Resolved doubt with Faculty-Verified Answer and Accepted Solution
  const doubt2 = await prisma.doubt.upsert({
    where: { id: 'doubt-cs301-lucas-02' },
    update: {},
    create: {
      id: 'doubt-cs301-lucas-02',
      institutionId: institution.id,
      subjectId: subject.id,
      studentId: student.id,
      facultyId: faculty.id,
      title: 'Difference between Safety and Liveness in Paxos',
      content: 'Could you clarify the FLP impossibility theorem implication on Paxos liveness under network partitions?',
      reply: 'Safety guarantees that at most one value is decided (nothing bad happens), while liveness guarantees that learning happens eventually (something good happens). In asynchronous networks with one faulty process, deterministic consensus cannot guarantee liveness under partitions.',
      tags: ['paxos', 'flp-theorem', 'theory'],
      isAnonymous: false,
      isResolved: true,
      resolvedAt: new Date(),
      upvotesCount: 7,
    },
  });

  const reply1 = await prisma.doubtReply.upsert({
    where: { id: 'reply-doubt2-faculty' },
    update: {},
    create: {
      id: 'reply-doubt2-faculty',
      institutionId: institution.id,
      doubtId: doubt2.id,
      authorId: faculty.id,
      content: 'Safety guarantees that at most one value is decided (no two learners decide different values). Liveness guarantees that decisions will eventually be reached once network synchrony stabilizes. Under asynchronous partitions, FLP proves deterministic progress is impossible, but Paxos guarantees safety unconditionally.',
      codeSnippet: `// Classic Paxos Phase 2b condition:
if (proposal_number >= highest_promised_proposal) {
    accepted_value = value;
    send_accepted(proposal_number, accepted_value);
}`,
      codeLanguage: 'cpp',
      isFacultyVerified: true,
      verifiedById: faculty.id,
      upvotesCount: 5,
    },
  });

  await prisma.doubt.update({
    where: { id: doubt2.id },
    data: { acceptedReplyId: reply1.id },
  });

  // Doubt 3: Anonymous doubt
  await prisma.doubt.upsert({
    where: { id: 'doubt-cs301-anon-03' },
    update: {},
    create: {
      id: 'doubt-cs301-anon-03',
      institutionId: institution.id,
      subjectId: subject.id,
      studentId: student.id,
      title: 'Atomic compare_exchange_weak vs compare_exchange_strong in lock-free queues',
      content: 'Why does Michael-Scott lock-free queue use weak compare exchange in loops instead of strong? Does it prevent spurious failure overhead on ARM architectures?',
      codeSnippet: `template<typename T>
void LockFreeQueue<T>::push(T val) {
    Node* new_node = new Node(val);
    Node* tail = nullptr;
    while (true) {
        tail = m_tail.load(std::memory_order_acquire);
        Node* next = tail->next.load(std::memory_order_acquire);
        if (tail == m_tail.load()) {
            if (next == nullptr) {
                if (tail->next.compare_exchange_weak(next, new_node, std::memory_order_release)) break;
            } else {
                m_tail.compare_exchange_weak(tail, next, std::memory_order_release);
            }
        }
    }
}`,
      codeLanguage: 'cpp',
      tags: ['c++', 'concurrency', 'lock-free'],
      isAnonymous: true,
      isResolved: false,
      upvotesCount: 4,
    },
  });
  console.log('✓ Student doubts seeded (Anonymous question, code snippets, verified replies)');

  // 15B. Community Posts & Feed with Visibility Scopes and Polls
  const post1 = await prisma.communityPost.upsert({
    where: { id: 'post-symposium-announcement' },
    update: {},
    create: {
      id: 'post-symposium-announcement',
      institutionId: institution.id,
      authorId: admin.id,
      scope: PostScope.INSTITUTION,
      section: PostSection.EVENTS,
      title: 'Annual Tech Symposium & Hackathon 2026 Announced!',
      content: 'We are thrilled to announce EduSphere Tech Conclave 2026. Over $25,000 in prizes, keynotes by industry luminaries, and project showcases. Registrations open this Friday.',
      hashtags: ['#Hackathon2026', '#Innovation', '#CampusLife'],
      isVerifiedAnnouncement: true,
      isPinned: true,
      likesCount: 18,
      commentsCount: 2,
    },
  });

  // Post 2: Department Feed Post with Interactive Poll
  const post2 = await prisma.communityPost.upsert({
    where: { id: 'post-dept-poll' },
    update: {},
    create: {
      id: 'post-dept-poll',
      institutionId: institution.id,
      authorId: faculty.id,
      scope: PostScope.DEPARTMENT,
      departmentId: department.id,
      section: PostSection.DEPARTMENT,
      title: 'Department of Computer Science: Cloud Systems elective lab tooling',
      content: 'We are deciding the core systems language for the upcoming Distributed Systems Capstone project. Cast your vote below to help shape the lab curriculum!',
      hashtags: ['#ComputerScience', '#CurriculumPoll', '#SystemsProgramming'],
      isVerifiedAnnouncement: true,
      likesCount: 12,
      commentsCount: 1,
    },
  });

  const pollOptions = [
    { id: '0', text: 'Rust (Memory safety & async Tokio)', voteCount: 19 },
    { id: '1', text: 'Go (Goroutines & lightweight channels)', voteCount: 14 },
    { id: '2', text: 'Python (Fast prototyping & asyncio)', voteCount: 6 },
    { id: '3', text: 'TypeScript / Node.js (Full-stack unified)', voteCount: 8 },
  ];

  await prisma.postPoll.upsert({
    where: { postId: post2.id },
    update: {},
    create: {
      institutionId: institution.id,
      postId: post2.id,
      question: 'Which systems programming language do you prefer for the Raft consensus lab?',
      options: pollOptions,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
    },
  });

  // Post 3: Achievements
  await prisma.communityPost.upsert({
    where: { id: 'post-achievement-bytelab' },
    update: {},
    create: {
      id: 'post-achievement-bytelab',
      institutionId: institution.id,
      authorId: faculty.id,
      scope: PostScope.INSTITUTION,
      section: PostSection.ACHIEVEMENTS,
      title: '1st Place Victory in National Smart Campus Challenge!',
      content: 'Heartiest congratulations to the team of CS seniors Lucas Vance and Maya Lin for securing top honors for their edge computing energy auditor project!',
      hashtags: ['#StudentSuccess', '#ProudMoment', '#Winner'],
      likesCount: 29,
      commentsCount: 3,
    },
  });

  // Post 4: Lost & Found
  await prisma.communityPost.upsert({
    where: { id: 'post-lost-and-found-01' },
    update: {},
    create: {
      id: 'post-lost-and-found-01',
      institutionId: institution.id,
      authorId: student.id,
      scope: PostScope.INSTITUTION,
      section: PostSection.LOST_AND_FOUND,
      title: 'Found: White Apple Pencil in Turing Hall 101',
      content: 'Found an Apple Pencil 2nd Gen under desk row 4 after the CS301 morning lecture. Handed it over to the CS Department front desk.',
      hashtags: ['#LostAndFound', '#CampusHelp'],
      likesCount: 5,
    },
  });

  console.log('✓ Community posts, verified announcements, and interactive polls seeded');

  // 16. In-App Notifications
  const sampleNotifications = [
    {
      institutionId: institution.id,
      userId: student.id,
      category: NotificationCategory.EXAM,
      title: 'Marks Published: Midterm Internal Exam 1',
      body: 'Your scores for Midterm Internal Exam 1 in CS301 are now officially published. Grade: A (44.5/50).',
      link: '/student',
      isRead: false,
    },
    {
      institutionId: institution.id,
      userId: student.id,
      category: NotificationCategory.ACADEMIC,
      title: 'New Material: Raft Consensus Protocol & Safety Invariants',
      body: 'Dr. Elena Rostova uploaded lecture notes and slides for Unit 1 in Distributed Systems.',
      link: '/student',
      isRead: true,
    },
    {
      institutionId: institution.id,
      userId: student.id,
      category: NotificationCategory.ANNOUNCEMENT,
      title: 'Campus Announcement: Attendance Threshold Policy',
      body: 'Review the mandatory 75% threshold policy published by the administration office.',
      link: '/student',
      isRead: false,
    },
    {
      institutionId: institution.id,
      userId: faculty.id,
      category: NotificationCategory.COMMUNITY,
      title: 'New Student Doubt: Term monotonicity in Raft',
      body: 'Lucas Vance asked a question regarding election terms in CS301.',
      link: '/faculty',
      isRead: false,
    },
  ];

  for (const notif of sampleNotifications) {
    await prisma.notification.create({ data: notif });
  }
  console.log('✓ Initial notification bell records seeded for student and faculty');

  // 17. Audit Log
  await prisma.auditLog.create({
    data: {
      institutionId: institution.id,
      userId: admin.id,
      action: 'SYSTEM_INITIALIZATION',
      resource: 'institution',
      resourceId: institution.id,
      details: {
        seededBy: 'Prisma Seed Engine',
        modulesSeeded: ['Auth', 'Materials', 'Canvas', 'Attendance', 'Marks', 'Notifications', 'Dashboards'],
      },
    },
  });

  console.log('\n✅ EduSphere Database fully seeded with rich multi-module records!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
