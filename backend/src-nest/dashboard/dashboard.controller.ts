import { Controller, Get, Param, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { PlatformQueryDto } from './dto/platform-query.dto';
import { CourseBreakdownQueryDto } from './dto/course-breakdown-query.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('platforms/summary')
  summary(@Query() query: PlatformQueryDto) {
    return this.dashboardService.getPlatformSummary(query.moodleSource);
  }

  @Get('platforms/history')
  history(@Query() query: PlatformQueryDto) {
    return this.dashboardService.getPlatformHistory(query.moodleSource);
  }

  @Get('platforms/history/global-storage')
  globalStorageHistory() {
    return this.dashboardService.getGlobalStorageHistory();
  }

  @Get('courses')
  courses(@Query() query: PlatformQueryDto) {
    return this.dashboardService.getCourses(query.moodleSource);
  }

  @Get('courses/:courseId/breakdown')
  courseBreakdown(@Param('courseId') courseId: string, @Query() query: CourseBreakdownQueryDto) {
    return this.dashboardService.getCourseBreakdown(Number(courseId), query.moodleSource, query.refresh);
  }

  @Get('users/top')
  topUsers(@Query() query: PlatformQueryDto) {
    return this.dashboardService.getTopUsers(query.moodleSource);
  }
}
