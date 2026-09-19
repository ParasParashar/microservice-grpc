import { Module } from '@nestjs/common';
import { ProfileModule } from 'src/profile/profile.module';

@Module({
  imports: [ProfileModule],
})
export class AppModule { }
