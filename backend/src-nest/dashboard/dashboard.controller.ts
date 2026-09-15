import { Controller, Get, Param, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { PlatformQueryDto } from './dto/platform-query.dto';
import { CourseBreakdownQueryDto } from './dto/course-breakdown-query.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { PublicUser } from '../auth/auth.service';

// Expone todos los endpoints de lectura que alimentan el dashboard. Es solo
// enrutamiento: toda la lógica vive en DashboardService. Las rutas de
// "Storage" (resumen/histórico de almacenamiento y top de usuarios) son
// exclusivas de superadmin — @Roles('admin'); las de "Moodle Insights"
// (cursos, informes de curso, insights) están abiertas a ambos roles, mismo
// filtrado/validación de qué plataformas puede ver un usuario "limited" en
// el propio DashboardService.
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('platforms/summary')
  @Roles('admin')
  summary(@Query() query: PlatformQueryDto) {
    return this.dashboardService.getPlatformSummary(query.moodleSource);
  }

  @Get('platforms/history')
  @Roles('admin')
  history(@Query() query: PlatformQueryDto) {
    return this.dashboardService.getPlatformHistory(query.moodleSource);
  }

  @Get('platforms/history/global-storage')
  @Roles('admin')
  globalStorageHistory() {
    return this.dashboardService.getGlobalStorageHistory();
  }

  @Get('courses')
  courses(@CurrentUser() currentUser: PublicUser, @Query() query: PlatformQueryDto) {
    return this.dashboardService.getCourses(currentUser, query.moodleSource);
  }

  @Get('courses/:courseId/breakdown')
  courseBreakdown(
    @CurrentUser() currentUser: PublicUser,
    @Param('courseId') courseId: string,
    @Query() query: CourseBreakdownQueryDto,
  ) {
    return this.dashboardService.getCourseBreakdown(currentUser, Number(courseId), query.moodleSource, query.refresh);
  }

  @Get('courses/:courseId/access-report')
  courseAccessReport(
    @CurrentUser() currentUser: PublicUser,
    @Param('courseId') courseId: string,
    @Query() query: PlatformQueryDto,
  ) {
    return this.dashboardService.getCourseAccessReport(currentUser, Number(courseId), query.moodleSource);
  }

  @Get('courses/:courseId/grades-report')
  courseGradesReport(
    @CurrentUser() currentUser: PublicUser,
    @Param('courseId') courseId: string,
    @Query() query: PlatformQueryDto,
  ) {
    return this.dashboardService.getCourseGradesReport(currentUser, Number(courseId), query.moodleSource);
  }

  @Get('users/top')
  @Roles('admin')
  topUsers(@Query() query: PlatformQueryDto) {
    return this.dashboardService.getTopUsers(query.moodleSource);
  }

  @Get('insights')
  insights(@CurrentUser() currentUser: PublicUser, @Query() query: PlatformQueryDto) {
    return this.dashboardService.getInsights(currentUser, query.moodleSource);
  }
}
